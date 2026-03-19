import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_API_BASE_URL = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";

const PAGE_SIZE = 1000;
const DB_CHUNK = 400;
const UPDATE_CHUNK = 200;
const REMOTE_FETCH_DELAY_MS = 250;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseStoredColorLabel(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return null;
  const label = clean.replace(/^lego:\s*/i, "").replace(/^bricklink:\s*/i, "").trim();
  return label || null;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function loadAllColoredListItems() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("list_items")
      .select("item_id, part_num, color_name, imgmatchcolor")
      .not("part_num", "is", null)
      .not("color_name", "is", null)
      .range(from, to);

    if (error) {
      throw new Error(`Failed loading list_items ${from}-${to}: ${error.message}`);
    }

    const page = (data ?? []).map((row) => ({
      item_id: String(row.item_id ?? "").trim(),
      part_num: String(row.part_num ?? "").trim(),
      color_name: String(row.color_name ?? "").trim(),
      imgmatchcolor: Boolean(row.imgmatchcolor),
    }));

    rows.push(...page.filter((row) => row.item_id && row.part_num && row.color_name));

    if ((data ?? []).length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchPartColorRows(partNums) {
  const byPartNum = new Map();

  for (const group of chunk(partNums, DB_CHUNK)) {
    const { data, error } = await supabase
      .from("part_color_catalog")
      .select("part_num, color_name, part_img_url")
      .in("part_num", group);

    if (error) {
      throw new Error(`Failed loading part_color_catalog: ${error.message}`);
    }

    for (const row of data ?? []) {
      const partNum = String(row.part_num ?? "").trim();
      const colorName = String(row.color_name ?? "").trim();
      const partImgUrl = row.part_img_url ? String(row.part_img_url) : null;
      if (!partNum || !colorName) continue;
      if (!byPartNum.has(partNum)) {
        byPartNum.set(partNum, []);
      }
      byPartNum.get(partNum).push({ color_name: colorName, part_img_url: partImgUrl });
    }
  }

  return byPartNum;
}

async function fetchAndCachePartColors(partNum) {
  if (!REBRICKABLE_API_KEY) {
    return [];
  }

  const collected = [];
  let nextUrl = `${REBRICKABLE_API_BASE_URL}/lego/parts/${encodeURIComponent(partNum)}/colors/?${new URLSearchParams({ page_size: "1000" }).toString()}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `key ${REBRICKABLE_API_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    const rows = Array.isArray(json.results) ? json.results : [];
    collected.push(...rows);
    nextUrl = json.next ? String(json.next) : null;
  }

  const normalized = collected
    .map((row) => ({
      color_name: String(row.color_name ?? "").trim(),
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
      color_id: row.color_id ? Number(row.color_id) : null,
    }))
    .filter((row) => row.color_name);

  if (normalized.length > 0) {
    const { error } = await supabase.from("part_color_catalog").upsert(
      normalized.map((row) => ({
        part_num: partNum,
        color_name: row.color_name,
        part_img_url: row.part_img_url,
        color_id: row.color_id,
      })),
      { onConflict: "part_num,color_name" },
    );

    if (error) {
      throw new Error(`Failed caching colors for ${partNum}: ${error.message}`);
    }
  }

  return normalized.map((row) => ({ color_name: row.color_name, part_img_url: row.part_img_url }));
}

function isColorImageMatch(colorRows, rawColorName) {
  const label = parseStoredColorLabel(rawColorName);
  if (!label) {
    return true;
  }

  const target = normalize(label);
  if (!target) {
    return true;
  }

  const exact = colorRows.find((row) => normalize(row.color_name) === target);
  if (exact?.part_img_url) {
    return true;
  }

  const partial = colorRows.find((row) => {
    const current = normalize(row.color_name);
    return current.includes(target) || target.includes(current);
  });

  return Boolean(partial?.part_img_url);
}

async function updateImgMatchFlags(itemIds, nextValue) {
  if (itemIds.length === 0) {
    return 0;
  }

  let updated = 0;
  for (const group of chunk(itemIds, UPDATE_CHUNK)) {
    const { error } = await supabase.from("list_items").update({ imgmatchcolor: nextValue }).in("item_id", group);
    if (error) {
      throw new Error(`Failed updating imgmatchcolor=${nextValue}: ${error.message}`);
    }
    updated += group.length;
  }
  return updated;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const fetchMissing = !args.has("--no-fetch");

  console.log(`Starting list_items imgmatchcolor repair (dryRun=${dryRun}, fetchMissing=${fetchMissing})...`);

  const rows = await loadAllColoredListItems();
  if (rows.length === 0) {
    console.log("No colored list_items found.");
    return;
  }

  const uniquePartNums = Array.from(new Set(rows.map((row) => row.part_num)));
  const colorRowsByPartNum = await fetchPartColorRows(uniquePartNums);

  if (fetchMissing) {
    const missingPartNums = uniquePartNums.filter((partNum) => !colorRowsByPartNum.has(partNum));
    let fetchedCount = 0;
    for (const partNum of missingPartNums) {
      const fetched = await fetchAndCachePartColors(partNum);
      if (fetched.length > 0) {
        colorRowsByPartNum.set(partNum, fetched);
      }
      fetchedCount += 1;
      if (fetchedCount % 10 === 0) {
        console.log(`Fetched missing color catalogs: ${fetchedCount}/${missingPartNums.length}`);
      }
      await sleep(REMOTE_FETCH_DELAY_MS);
    }
  }

  const toTrue = [];
  const toFalse = [];

  for (const row of rows) {
    const colorRows = colorRowsByPartNum.get(row.part_num) ?? [];
    const shouldBeMatch = isColorImageMatch(colorRows, row.color_name);

    if (shouldBeMatch !== row.imgmatchcolor) {
      if (shouldBeMatch) {
        toTrue.push(row.item_id);
      } else {
        toFalse.push(row.item_id);
      }
    }
  }

  console.log(`Scanned rows: ${rows.length}`);
  console.log(`Need update -> true: ${toTrue.length}`);
  console.log(`Need update -> false: ${toFalse.length}`);

  if (dryRun) {
    console.log("Dry run complete. No DB updates executed.");
    return;
  }

  const updatedTrue = await updateImgMatchFlags(toTrue, true);
  const updatedFalse = await updateImgMatchFlags(toFalse, false);

  console.log(`Updated imgmatchcolor=true : ${updatedTrue}`);
  console.log(`Updated imgmatchcolor=false: ${updatedFalse}`);
  console.log("Repair complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
