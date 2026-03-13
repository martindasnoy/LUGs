import dotenv from "dotenv";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_API_BASE_URL = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";

const PAGE_SIZE = 200;
const UPSERT_BATCH_SIZE = 300;
const REQUEST_DELAY_MS = 900;
const MAX_RETRIES = 5;

const CHECKPOINT_DIR = ".sync";
const CHECKPOINT_PATH = `${CHECKPOINT_DIR}/rebrickable-parts-checkpoint.json`;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!REBRICKABLE_API_KEY) missing.push("REBRICKABLE_API_KEY");

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCheckpoint() {
  try {
    const raw = await readFile(CHECKPOINT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { nextPage: 1, processed: 0, upserted: 0, startedAt: new Date().toISOString() };
  }
}

async function saveCheckpoint(checkpoint) {
  await mkdir(CHECKPOINT_DIR, { recursive: true });
  await writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), "utf8");
}

async function clearCheckpoint() {
  await rm(CHECKPOINT_PATH, { force: true });
}

function parseRetryAfterMs(text) {
  const match = String(text).match(/available in\s+(\d+)\s+seconds?/i);
  if (!match) return null;
  return Number(match[1]) * 1000;
}

async function fetchPage(page) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
  });

  const url = `${REBRICKABLE_API_BASE_URL}/lego/parts/?${params.toString()}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `key ${REBRICKABLE_API_KEY}`,
      },
    });

    if (response.ok) {
      return response.json();
    }

    const body = await response.text();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterMs = parseRetryAfterMs(body) ?? attempt * 2000;
      console.warn(`429 on page ${page}. Retrying in ${retryAfterMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(retryAfterMs);
      continue;
    }

    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const waitMs = attempt * 1500;
      console.warn(`Server error ${response.status} on page ${page}. Retrying in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Rebrickable error ${response.status} on page ${page}: ${body}`);
  }

  throw new Error(`Failed to fetch page ${page}`);
}

async function upsertParts(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return 0;
  }

  let total = 0;

  for (let i = 0; i < results.length; i += UPSERT_BATCH_SIZE) {
    const chunk = results.slice(i, i + UPSERT_BATCH_SIZE);
    const payload = chunk.map((row) => ({
      part_num: String(row.part_num ?? ""),
      name: String(row.name ?? ""),
      part_cat_id: row.part_cat_id ? Number(row.part_cat_id) : null,
      part_url: row.part_url ? String(row.part_url) : null,
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
    }));

    const { error } = await supabase.from("parts_catalog").upsert(payload, { onConflict: "part_num" });

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    total += payload.length;
  }

  return total;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldReset = args.has("--reset");

  if (shouldReset) {
    await clearCheckpoint();
    console.log("Checkpoint reset.");
  }

  const checkpoint = await loadCheckpoint();
  let page = Number(checkpoint.nextPage ?? 1);
  let processed = Number(checkpoint.processed ?? 0);
  let upserted = Number(checkpoint.upserted ?? 0);

  console.log(`Starting parts sync from page ${page}...`);

  while (true) {
    const json = await fetchPage(page);
    const results = Array.isArray(json.results) ? json.results : [];
    const count = Number(json.count ?? 0);

    const saved = await upsertParts(results);

    processed += results.length;
    upserted += saved;

    const nextPage = json.next ? page + 1 : null;

    await saveCheckpoint({
      nextPage: nextPage ?? page,
      processed,
      upserted,
      total: count,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `Page ${page}: fetched ${results.length}, upserted ${saved}. Progress ${processed}/${count || "?"} (${count ? Math.round((processed / count) * 100) : 0}%).`,
    );

    if (!json.next) {
      break;
    }

    page += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  await clearCheckpoint();
  console.log(`Done. Upserted ${upserted} parts.`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
