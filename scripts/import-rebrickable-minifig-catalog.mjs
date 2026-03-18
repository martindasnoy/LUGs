import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_API_BASE_URL = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";

const argv = process.argv.slice(2);
const args = Object.fromEntries(
  argv
    .filter((item) => item.startsWith("--"))
    .map((item) => {
      const [rawKey, rawValue] = item.replace(/^--/, "").split("=");
      return [rawKey, rawValue ?? "true"];
    }),
);

const importSeries = args.series !== "false";
const importSets = args.sets !== "false";
const importParts = args.parts === "true";
const dryRun = args["dry-run"] === "true";
const resetCatalog = args.reset === "true";
const maxThemes = Number(args["max-themes"] ?? 0) || 0;
const maxSets = Number(args["max-sets"] ?? 0) || 0;
const onlyThemeId = Number(args["theme-id"] ?? 0) || 0;
const onlySetNum = String(args["set-num"] ?? "").trim();
const forceParts = args["force-parts"] === "true";

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

function chunk(array, size) {
  const rows = [];
  for (let index = 0; index < array.length; index += size) {
    rows.push(array.slice(index, index + size));
  }
  return rows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadAllSetNumsFromPartsCatalog() {
  const allRows = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("minifigure_set_parts_catalog")
      .select("set_num")
      .order("set_num", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Load imported sets for parts error: ${error.message}`);
    }

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return allRows;
}

async function fetchPagedRows(url) {
  const allRows = [];
  let nextUrl = url;

  while (nextUrl) {
    const payload = await fetchRebrickableJson(nextUrl);
    const results = Array.isArray(payload.results) ? payload.results : [];
    allRows.push(...results);
    nextUrl = payload.next ? String(payload.next) : null;
  }

  return allRows;
}

function getRetryDelayMs(status, textBody, attempt) {
  const retryFromHeader = 0;
  if (status !== 429) {
    return 0;
  }

  const match = String(textBody ?? "").match(/available in\s+(\d+)\s+seconds/i);
  const seconds = match ? Number(match[1]) || 0 : 0;
  if (seconds > 0) {
    return seconds * 1000;
  }

  const fallbackSeconds = Math.min(90, 10 + attempt * 10);
  return Math.max(retryFromHeader, fallbackSeconds * 1000);
}

async function fetchRebrickableJson(url, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `key ${REBRICKABLE_API_KEY}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json();
    }

    const body = await response.text();
    const delayMs = getRetryDelayMs(response.status, body, attempt);
    const canRetry = response.status === 429 && attempt < maxRetries;

    if (canRetry && delayMs > 0) {
      const waitSeconds = Math.ceil(delayMs / 1000);
      console.log(`Rebrickable throttled (${response.status}). Retry ${attempt + 1}/${maxRetries} in ${waitSeconds}s...`);
      await sleep(delayMs);
      continue;
    }

    throw new Error(`Rebrickable ${response.status}: ${body}`);
  }

  throw new Error("Unexpected Rebrickable fetch retry state");
}

async function fetchAllThemes() {
  return fetchPagedRows(
    `${REBRICKABLE_API_BASE_URL}/lego/themes/?${new URLSearchParams({
      page_size: "1000",
      ordering: "name",
    }).toString()}`,
  );
}

async function fetchThemeStats(themeId) {
  const payload = await fetchRebrickableJson(
    `${REBRICKABLE_API_BASE_URL}/lego/sets/?${new URLSearchParams({
      theme_id: String(themeId),
      page_size: "1",
      ordering: "year",
    }).toString()}`,
  );
  const first = Array.isArray(payload.results) ? payload.results[0] : null;
  const year = first?.year == null ? null : Number(first.year);
  const setCount = Number(payload.count ?? 0) || 0;
  return {
    year_from: Number.isFinite(year) ? year : null,
    set_count: setCount,
  };
}

async function importSeriesCatalog() {
  const themes = await fetchAllThemes();
  const normalized = themes.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? "").trim(),
    parent_id: row.parent_id == null ? null : Number(row.parent_id),
    year_from: row.year_from == null ? null : Number(row.year_from),
    year_to: row.year_to == null ? null : Number(row.year_to),
  }));

  const byId = new Map();
  normalized.forEach((row) => {
    if (row.id > 0) byId.set(row.id, row);
  });

  const rootIds = new Set(
    normalized
      .filter((row) => {
        const name = row.name.toLowerCase();
        return (
          name === "collectable minifigures" ||
          name === "collectible minifigures" ||
          (name.includes("collect") && name.includes("minifig"))
        );
      })
      .map((row) => row.id),
  );

  function belongsToCollectableFamily(themeId) {
    const visited = new Set();
    let cursor = byId.get(themeId) ?? null;
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      const name = cursor.name.toLowerCase();
      if (
        rootIds.has(cursor.id) ||
        name === "collectable minifigures" ||
        name === "collectible minifigures" ||
        (name.includes("collect") && name.includes("minifig"))
      ) {
        return true;
      }
      if (cursor.parent_id == null) return false;
      cursor = byId.get(cursor.parent_id) ?? null;
    }
    return false;
  }

  let filtered = normalized
    .filter((row) => {
      if (!row.id || !row.name) return false;
      if (!belongsToCollectableFamily(row.id)) return false;
      const name = row.name.toLowerCase();
      const isRoot =
        name === "collectable minifigures" ||
        name === "collectible minifigures" ||
        (name.includes("collect") && name.includes("minifig") && row.parent_id == null);
      return !isRoot;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  if (onlyThemeId > 0) {
    filtered = filtered.filter((row) => row.id === onlyThemeId);
  }
  if (maxThemes > 0) {
    filtered = filtered.slice(0, maxThemes);
  }

  const enriched = [];
  for (const series of filtered) {
    const stats = await fetchThemeStats(series.id);
    enriched.push({
      id: series.id,
      name: series.name,
      parent_id: series.parent_id,
      year_from: stats.year_from ?? series.year_from,
      year_to: stats.year_from ?? series.year_to,
      set_count: stats.set_count,
      updated_at: new Date().toISOString(),
    });
    await sleep(40);
  }

  enriched.sort((a, b) => {
    const ay = a.year_from ?? 9999;
    const by = b.year_from ?? 9999;
    if (ay !== by) return ay - by;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });

  console.log(`Series candidates: ${enriched.length}`);
  if (dryRun || enriched.length === 0) {
    return enriched;
  }

  const payload = enriched.map((row) => ({
    theme_id: row.id,
    name: row.name,
    parent_theme_id: row.parent_id,
    year_from: row.year_from,
    year_to: row.year_to,
    set_count: row.set_count,
    updated_at: row.updated_at,
  }));

  const { error } = await supabase.from("minifigure_series_catalog").upsert(payload, { onConflict: "theme_id" });
  if (error) {
    throw new Error(`Series upsert error: ${error.message}`);
  }

  return enriched;
}

function filterInvalidSetRows(rows) {
  return rows.filter((row) => {
    const name = String(row.name ?? "").toLowerCase();
    const numParts = Math.max(0, Number(row.num_parts ?? 0) || 0);
    const hasPackagingKeywords = /\b(?:box|pack)\b/.test(name);
    if (
      name.includes("complete") ||
      name.includes("random bag") ||
      name.includes("sealed box") ||
      name.includes("random box") ||
      hasPackagingKeywords
    ) {
      return false;
    }
    if (numParts <= 0) {
      return false;
    }
    return true;
  });
}

async function fetchThemeSets(themeId) {
  const rows = await fetchPagedRows(
    `${REBRICKABLE_API_BASE_URL}/lego/sets/?${new URLSearchParams({
      theme_id: String(themeId),
      page_size: "1000",
      ordering: "name",
    }).toString()}`,
  );

  return filterInvalidSetRows(rows).map((row) => ({
    set_num: String(row.set_num ?? "").trim(),
    name: String(row.name ?? "").trim(),
    set_img_url: row.set_img_url ? String(row.set_img_url) : null,
    num_parts: Math.max(0, Number(row.num_parts ?? 0) || 0),
    year: row.year == null ? null : Number(row.year),
    theme_id: Number(row.theme_id ?? themeId),
    updated_at: new Date().toISOString(),
  }));
}

async function importSetsCatalog(themeRows) {
  const sourceThemes = onlyThemeId > 0 ? themeRows.filter((row) => row.id === onlyThemeId) : themeRows;
  const allSets = [];

  for (const theme of sourceThemes) {
    const rows = await fetchThemeSets(theme.id);
    allSets.push(...rows);
    console.log(`Theme ${theme.id} -> ${rows.length} sets`);
    await sleep(40);
  }

  let finalRows = allSets.filter((row) => row.set_num && row.name && row.theme_id > 0);
  if (onlySetNum) {
    finalRows = finalRows.filter((row) => row.set_num === onlySetNum);
  }
  if (maxSets > 0) {
    finalRows = finalRows.slice(0, maxSets);
  }

  console.log(`Set candidates: ${finalRows.length}`);
  if (dryRun || finalRows.length === 0) {
    return finalRows;
  }

  for (const batch of chunk(finalRows, 500)) {
    const { error } = await supabase.from("minifigure_sets_catalog").upsert(batch, { onConflict: "set_num" });
    if (error) {
      throw new Error(`Sets upsert error: ${error.message}`);
    }
  }

  return finalRows;
}

async function fetchSetPartsMerged(setNum) {
  const setParts = await fetchPagedRows(
    `${REBRICKABLE_API_BASE_URL}/lego/sets/${encodeURIComponent(setNum)}/parts/?${new URLSearchParams({
      page_size: "1000",
      ordering: "part",
    }).toString()}`,
  );

  const minifigs = await fetchPagedRows(
    `${REBRICKABLE_API_BASE_URL}/lego/sets/${encodeURIComponent(setNum)}/minifigs/?${new URLSearchParams({
      page_size: "1000",
    }).toString()}`,
  );

  const minifigParts = [];
  for (const minifig of minifigs) {
    const minifigSetNum = String(minifig.set_num ?? "").trim();
    if (!minifigSetNum) continue;
    const minifigQty = Math.max(1, Number(minifig.quantity ?? 1) || 1);
    const rows = await fetchPagedRows(
      `${REBRICKABLE_API_BASE_URL}/lego/minifigs/${encodeURIComponent(minifigSetNum)}/parts/?${new URLSearchParams({
        page_size: "1000",
        ordering: "part",
      }).toString()}`,
    );

    minifigParts.push(
      ...rows.map((row) => ({
        ...row,
        quantity: Math.max(1, Number(row.quantity ?? 1) || 1) * minifigQty,
      })),
    );
    await sleep(25);
  }

  const combined = [...setParts, ...minifigParts];
  const grouped = new Map();

  for (const row of combined) {
    const partNum = String(row.part?.part_num ?? "").trim();
    if (!partNum) continue;
    const colorName = String(row.color?.name ?? "").trim();
    const key = `${partNum}::${colorName}`;
    const current = grouped.get(key);
    const quantity = Math.max(1, Number(row.quantity ?? 1) || 1);

    if (current) {
      current.quantity += quantity;
      if (!current.part_img_url && row.part?.part_img_url) {
        current.part_img_url = String(row.part.part_img_url);
      }
    } else {
      grouped.set(key, {
        set_num: setNum,
        part_num: partNum,
        part_name: String(row.part?.name ?? ""),
        color_name: colorName,
        part_img_url: row.part?.part_img_url ? String(row.part.part_img_url) : null,
        quantity,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return Array.from(grouped.values());
}

async function importPartsCatalog(setRows) {
  let sets = setRows;

  if (sets.length === 0) {
    let query = supabase
      .from("minifigure_sets_catalog")
      .select("set_num, parts_import_status")
      .order("set_num", { ascending: true });

    if (onlyThemeId > 0) {
      query = query.eq("theme_id", onlyThemeId);
    }

    const shouldApplyEarlyLimit = maxSets > 0 && (forceParts || Boolean(onlySetNum));
    const { data, error } = onlySetNum
      ? await query.eq("set_num", onlySetNum).limit(1)
      : shouldApplyEarlyLimit
        ? await query.limit(maxSets)
        : await query;

    if (error) {
      throw new Error(`Load sets for parts error: ${error.message}`);
    }

    sets = (data ?? [])
      .map((row) => ({
        set_num: String(row.set_num ?? ""),
        parts_import_status: String(row.parts_import_status ?? "pending").toLowerCase(),
      }))
      .filter((row) => row.set_num);
  }

  if (!forceParts && !onlySetNum) {
    const importedRows = await loadAllSetNumsFromPartsCatalog();
    const importedSetNums = new Set((importedRows ?? []).map((row) => String(row.set_num ?? "")).filter(Boolean));

    sets = sets.filter((row) => {
      const status = String(row.parts_import_status ?? "pending");
      if (status === "imported" || status === "empty") {
        return false;
      }
      return !importedSetNums.has(String(row.set_num));
    });

    if (maxSets > 0) {
      sets = sets.slice(0, maxSets);
    }

    console.log(`Sets already with parts: ${importedSetNums.size}`);
  }

  console.log(`Part import set count: ${sets.length}`);

  if (sets.length === 0) {
    console.log("No pending sets for parts import.");
    return;
  }

  let processed = 0;
  for (const row of sets) {
    const setNum = String(row.set_num);
    const parts = await fetchSetPartsMerged(setNum);

    if (!dryRun) {
      const { error: deleteError } = await supabase.from("minifigure_set_parts_catalog").delete().eq("set_num", setNum);
      if (deleteError) {
        throw new Error(`Delete old set parts error (${setNum}): ${deleteError.message}`);
      }

      if (parts.length > 0) {
        for (const batch of chunk(parts, 500)) {
          const { error: upsertError } = await supabase.from("minifigure_set_parts_catalog").upsert(batch, {
            onConflict: "set_num,part_num,color_name",
          });
          if (upsertError) {
            throw new Error(`Parts upsert error (${setNum}): ${upsertError.message}`);
          }
        }
      }

      const nextStatus = parts.length > 0 ? "imported" : "empty";
      const { error: setStatusError } = await supabase
        .from("minifigure_sets_catalog")
        .update({
          parts_import_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("set_num", setNum);
      if (setStatusError) {
        throw new Error(`Set status update error (${setNum}): ${setStatusError.message}`);
      }
    }

    processed += 1;
    console.log(`[${processed}/${sets.length}] ${setNum} -> ${parts.length} grouped parts`);
    await sleep(50);
  }
}

async function main() {
  console.log("Importing Rebrickable minifig catalog into local tables...");
  console.log(
    JSON.stringify(
      {
        importSeries,
        importSets,
        importParts,
        dryRun,
        resetCatalog,
        maxThemes,
        maxSets,
        onlyThemeId: onlyThemeId || null,
        onlySetNum: onlySetNum || null,
        forceParts,
      },
      null,
      2,
    ),
  );

  if (resetCatalog && !dryRun) {
    const { error: deletePartsError } = await supabase.from("minifigure_set_parts_catalog").delete().neq("set_num", "");
    if (deletePartsError) throw new Error(`Reset parts error: ${deletePartsError.message}`);
    const { error: deleteSetsError } = await supabase.from("minifigure_sets_catalog").delete().neq("set_num", "");
    if (deleteSetsError) throw new Error(`Reset sets error: ${deleteSetsError.message}`);
    const { error: deleteSeriesError } = await supabase.from("minifigure_series_catalog").delete().gt("theme_id", 0);
    if (deleteSeriesError) throw new Error(`Reset series error: ${deleteSeriesError.message}`);
    console.log("Catalog reset completed.");
  }

  let seriesRows = [];
  if (importSeries || importSets) {
    seriesRows = await importSeriesCatalog();
    console.log(`Series imported: ${seriesRows.length}${dryRun ? " (dry-run)" : ""}`);
  }

  let setRows = [];
  if (importSets) {
    setRows = await importSetsCatalog(seriesRows);
    console.log(`Sets imported: ${setRows.length}${dryRun ? " (dry-run)" : ""}`);
  }

  if (importParts) {
    await importPartsCatalog(setRows);
    console.log(`Parts imported for ${setRows.length || maxSets || "selected"} sets${dryRun ? " (dry-run)" : ""}`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
