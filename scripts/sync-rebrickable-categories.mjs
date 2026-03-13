import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_API_BASE_URL = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!REBRICKABLE_API_KEY) missing.push("REBRICKABLE_API_KEY");

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  console.error("Tip: set SUPABASE_SERVICE_ROLE_KEY in .env.local (or SUPABASE_SERVICE_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllCategories() {
  const all = [];
  let page = 1;

  while (true) {
    const url = `${REBRICKABLE_API_BASE_URL}/lego/part_categories/?page=${page}&page_size=1000`;
    const response = await fetch(url, {
      headers: {
        Authorization: `key ${REBRICKABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Rebrickable error ${response.status}: ${body}`);
    }

    const json = await response.json();
    const rows = Array.isArray(json.results) ? json.results : [];
    all.push(...rows);

    console.log(`Fetched page ${page} (${rows.length} categories)`);

    if (!json.next) {
      break;
    }

    page += 1;
  }

  return all;
}

async function upsertCategories(rows) {
  if (rows.length === 0) {
    console.log("No categories to upsert.");
    return;
  }

  const payload = rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name || ""),
    part_count: Number(row.part_count || 0),
  }));

  const { error } = await supabase.from("part_categories").upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(`Supabase upsert error: ${error.message}`);
  }

  console.log(`Upserted ${payload.length} categories.`);
}

async function main() {
  console.log("Syncing Rebrickable categories...");
  const categories = await fetchAllCategories();
  await upsertCategories(categories);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
