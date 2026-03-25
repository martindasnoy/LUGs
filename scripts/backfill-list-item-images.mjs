import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_API_BASE_URL = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 400;
const UPDATE_CHUNK = 100;
const REMOTE_FETCH_DELAY_MS = 250;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeColorLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseStoredColorLabel(value) {
  const clean = String(value ?? "").trim();
  if (!clean) {
    return null;
  }
  const withoutPrefix = clean.replace(/^lego:\s*/i, "").replace(/^bricklink:\s*/i, "").trim();
  return withoutPrefix || null;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAllListItems() {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("list_items")
      .select("item_id, part_num, color_name, part_img_url, imgmatchcolor")
      .not("part_num", "is", null)
      .range(from, to);

    if (error) {
      throw new Error(`Failed loading list_items ${from}-${to}: ${error.message}`);
    }

    const pageRows = (data ?? [])
      .map((row) => ({
        item_id: String(row.item_id ?? "").trim(),
        part_num: String(row.part_num ?? "").trim(),
        color_name: row.color_name == null ? null : String(row.color_name).trim(),
        part_img_url: row.part_img_url == null ? null : String(row.part_img_url).trim() || null,
        imgmatchcolor: Boolean(row.imgmatchcolor),
      }))
      .filter((row) => row.item_id && row.part_num);

    rows.push(...pageRows);

    if ((data ?? []).length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }
  return rows;
}

async function loadCatalogMaps(partNums) {
  const partImageByNum = new Map();
  const colorRowsByPartNum = new Map();

  for (const group of chunk(partNums, CHUNK_SIZE)) {
    const [{ data: partsData, error: partsError }, { data: colorData, error: colorError }] = await Promise.all([
      supabase.from("parts_catalog").select("part_num, part_img_url").in("part_num", group),
      supabase.from("part_color_catalog").select("part_num, color_name, part_img_url").in("part_num", group),
    ]);

    if (partsError) {
      throw new Error(`Failed loading parts_catalog: ${partsError.message}`);
    }
    if (colorError) {
      throw new Error(`Failed loading part_color_catalog: ${colorError.message}`);
    }

    for (const row of partsData ?? []) {
      const partNum = String(row.part_num ?? "").trim();
      if (!partNum) {
        continue;
      }
      partImageByNum.set(partNum, row.part_img_url ? String(row.part_img_url) : null);
    }

    for (const row of colorData ?? []) {
      const partNum = String(row.part_num ?? "").trim();
      const colorName = String(row.color_name ?? "").trim();
      if (!partNum || !colorName) {
        continue;
      }
      if (!colorRowsByPartNum.has(partNum)) {
        colorRowsByPartNum.set(partNum, []);
      }
      colorRowsByPartNum.get(partNum).push({
        color_name: colorName,
        part_img_url: row.part_img_url ? String(row.part_img_url) : null,
      });
    }
  }

  return { partImageByNum, colorRowsByPartNum };
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

function resolveColorImage(colorRows, displayColor) {
  if (!displayColor) {
    return null;
  }
  const target = normalizeColorLabel(displayColor);
  if (!target) {
    return null;
  }

  const exact = colorRows.find((row) => normalizeColorLabel(row.color_name) === target);
  if (exact?.part_img_url) {
    return exact.part_img_url;
  }

  const partial = colorRows.find((row) => {
    const current = normalizeColorLabel(row.color_name);
    return current.includes(target) || target.includes(current);
  });
  return partial?.part_img_url ?? null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const fetchMissing = !args.has("--no-fetch");

  console.log(`Starting list_items image backfill (dryRun=${dryRun}, fetchMissing=${fetchMissing})...`);

  const rows = await loadAllListItems();
  if (rows.length === 0) {
    console.log("No list items found.");
    return;
  }

  const partNums = Array.from(new Set(rows.map((row) => row.part_num)));
  const { partImageByNum, colorRowsByPartNum } = await loadCatalogMaps(partNums);

  if (fetchMissing) {
    const missingByColorPartNums = new Set();
    for (const row of rows) {
      const displayColor = parseStoredColorLabel(row.color_name);
      if (!displayColor) {
        continue;
      }
      const colorRows = colorRowsByPartNum.get(row.part_num) ?? [];
      const hasColorImage = Boolean(resolveColorImage(colorRows, displayColor));
      if (!hasColorImage) {
        missingByColorPartNums.add(row.part_num);
      }
    }

    const candidates = Array.from(missingByColorPartNums);
    if (candidates.length > 0 && !REBRICKABLE_API_KEY) {
      console.log("REBRICKABLE_API_KEY missing. Skipping remote color fetch.");
    }

    let fetched = 0;
    for (const partNum of candidates) {
      const remoteRows = await fetchAndCachePartColors(partNum);
      if (remoteRows.length > 0) {
        colorRowsByPartNum.set(partNum, remoteRows);
      }
      fetched += 1;
      if (fetched % 10 === 0 || fetched === candidates.length) {
        console.log(`Fetched part colors: ${fetched}/${candidates.length}`);
      }
      await sleep(REMOTE_FETCH_DELAY_MS);
    }
  }

  const updates = [];

  for (const row of rows) {
    const displayColor = parseStoredColorLabel(row.color_name);
    const colorRows = colorRowsByPartNum.get(row.part_num) ?? [];
    const colorImage = resolveColorImage(colorRows, displayColor);
    const catalogImage = partImageByNum.get(row.part_num) ?? null;
    const resolvedImage = colorImage || row.part_img_url || catalogImage || null;
    const looksLikeColorSpecific = Boolean(row.part_img_url && row.part_img_url !== catalogImage);
    const resolvedMatch = displayColor ? Boolean(colorImage || looksLikeColorSpecific) : true;

    if (resolvedImage !== row.part_img_url || resolvedMatch !== row.imgmatchcolor) {
      updates.push({
        item_id: row.item_id,
        part_img_url: resolvedImage,
        imgmatchcolor: resolvedMatch,
      });
    }
  }

  console.log(`Scanned: ${rows.length}`);
  console.log(`To update: ${updates.length}`);

  if (dryRun || updates.length === 0) {
    console.log(dryRun ? "Dry run complete. No DB updates executed." : "No updates required.");
    return;
  }

  let updated = 0;
  for (const group of chunk(updates, UPDATE_CHUNK)) {
    for (const row of group) {
      const { error } = await supabase
        .from("list_items")
        .update({ part_img_url: row.part_img_url, imgmatchcolor: row.imgmatchcolor })
        .eq("item_id", row.item_id);

      if (error) {
        throw new Error(`Failed updating list_item ${row.item_id}: ${error.message}`);
      }
      updated += 1;
    }
    console.log(`Updated ${updated}/${updates.length}`);
  }

  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
