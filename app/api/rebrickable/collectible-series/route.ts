import { NextResponse } from "next/server";

const API_BASE = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";
const API_KEY = process.env.REBRICKABLE_API_KEY;

type RebrickableTheme = {
  id?: unknown;
  name?: unknown;
  parent_id?: unknown;
  year_from?: unknown;
  year_to?: unknown;
  set_count?: unknown;
};

async function fetchAllThemes() {
  const allRows: RebrickableTheme[] = [];
  let nextUrl: string | null = `${API_BASE}/lego/themes/?${new URLSearchParams({
    page_size: "1000",
    ordering: "name",
  }).toString()}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `key ${API_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Rebrickable ${response.status}: ${body}`);
    }

    const payload = (await response.json()) as {
      next?: string | null;
      results?: RebrickableTheme[];
    };

    allRows.push(...(Array.isArray(payload.results) ? payload.results : []));
    nextUrl = payload.next ? String(payload.next) : null;
  }

  return allRows;
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing REBRICKABLE_API_KEY" }, { status: 500 });
  }

  let rows: RebrickableTheme[] = [];
  try {
    rows = await fetchAllThemes();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }

  const normalized = rows.map((row) => ({
    id: Number(row.id ?? 0),
    name: String(row.name ?? "").trim(),
    parent_id: row.parent_id == null ? null : Number(row.parent_id),
    year_from: row.year_from == null ? null : Number(row.year_from),
    year_to: row.year_to == null ? null : Number(row.year_to),
    set_count: Number(row.set_count ?? 0),
  }));

  const byId = new Map<number, (typeof normalized)[number]>();
  normalized.forEach((row) => {
    if (row.id > 0) {
      byId.set(row.id, row);
    }
  });

  const rootIds = new Set<number>(
    normalized
      .filter((row) => {
        const name = row.name.toLowerCase();
        return name === "collectable minifigures" || name === "collectible minifigures";
      })
      .map((row) => row.id),
  );

  function belongsToCollectableFamily(themeId: number) {
    const visited = new Set<number>();
    let cursor = byId.get(themeId) ?? null;
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      const name = cursor.name.toLowerCase();
      if (rootIds.has(cursor.id) || name === "collectable minifigures" || name === "collectible minifigures") {
        return true;
      }
      if (cursor.parent_id == null) {
        return false;
      }
      cursor = byId.get(cursor.parent_id) ?? null;
    }
    return false;
  }

  const filtered = normalized
    .filter((row) => {
      if (!row.id || !row.name) {
        return false;
      }

      if (!belongsToCollectableFamily(row.id)) {
        return false;
      }

      const name = row.name.toLowerCase();
      const isRoot = name === "collectable minifigures" || name === "collectible minifigures";
      return !isRoot && row.set_count > 0;
    })
    .sort((a, b) => {
      const byYear = (b.year_from ?? 0) - (a.year_from ?? 0);
      if (byYear !== 0) return byYear;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });

  return NextResponse.json({
    count: filtered.length,
    results: filtered,
  });
}
