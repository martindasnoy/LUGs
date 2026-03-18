import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { MeiliSearch } from "meilisearch";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST;
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY;
const MEILISEARCH_PARTS_INDEX = process.env.MEILISEARCH_PARTS_INDEX || "parts_catalog";

const PAGE_SIZE = 2000;
const BATCH_SIZE = 1000;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!MEILISEARCH_HOST) missing.push("MEILISEARCH_HOST");
if (!MEILISEARCH_API_KEY) missing.push("MEILISEARCH_API_KEY");

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const meili = new MeiliSearch({
  host: MEILISEARCH_HOST,
  apiKey: MEILISEARCH_API_KEY,
});

function looksPrinted(partNum, name) {
  const code = String(partNum ?? "").toLowerCase();
  const title = String(name ?? "").toLowerCase();
  return /pb|pr|pat/.test(code) || title.includes("pattern") || title.includes("printed");
}

function normalizeDimensionText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s*x\s*/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureIndex(index) {
  try {
    await meili.getIndex(index.uid);
  } catch {
    await meili.createIndex(index.uid, { primaryKey: "part_num" });
  }

  await index.updateSearchableAttributes(["part_num", "name", "name_normalized", "search_text"]);
  await index.updateFilterableAttributes(["category_id", "is_printed"]);
  await index.updateSortableAttributes(["name_length"]);
  await index.updateRankingRules([
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "desc(is_printed)",
    "asc(name_length)",
  ]);
}

async function fetchAllParts() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("parts_catalog")
      .select("part_num, name, part_cat_id, part_img_url")
      .order("part_num", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    const chunk = data ?? [];
    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);
    from += PAGE_SIZE;

    if (chunk.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function main() {
  const index = meili.index(MEILISEARCH_PARTS_INDEX);

  await ensureIndex(index);

  console.log("Reading parts_catalog from Supabase...");
  const parts = await fetchAllParts();
  console.log(`Fetched ${parts.length} parts.`);

  const docs = parts.map((row) => {
    const partNum = String(row.part_num ?? "");
    const name = String(row.name ?? "");
    const nameNormalized = normalizeDimensionText(name);
    const isPrinted = looksPrinted(partNum, name);
    return {
      part_num: partNum,
      name,
      category_id: row.part_cat_id ? Number(row.part_cat_id) : null,
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
      is_printed: isPrinted,
      name_length: name.length,
      name_normalized: nameNormalized,
      search_text: `${partNum} ${name} ${nameNormalized}`.trim(),
    };
  });

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const task = await index.addDocuments(chunk);
    await meili.waitForTask(task.taskUid, { timeOutMs: 120000 });
    console.log(`Indexed ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }

  console.log(`Done. Indexed ${docs.length} docs into '${MEILISEARCH_PARTS_INDEX}'.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
