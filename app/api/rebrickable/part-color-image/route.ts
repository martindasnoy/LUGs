import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const API_BASE = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";
const API_KEY = process.env.REBRICKABLE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type RebrickableColorRow = {
  color_name?: unknown;
  part_img_url?: unknown;
  color_id?: unknown;
};

type CachedColorRow = {
  color_name: string;
  part_img_url: string | null;
};

function getServiceSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function findImage(rows: CachedColorRow[], colorName: string) {
  const target = normalize(colorName);

  const exact = rows.find((row) => normalize(String(row.color_name ?? "")) === target);
  if (exact?.part_img_url) {
    return String(exact.part_img_url);
  }

  const partial = rows.find((row) => {
    const rowName = normalize(String(row.color_name ?? ""));
    return rowName.includes(target) || target.includes(rowName);
  });

  return partial?.part_img_url ? String(partial.part_img_url) : null;
}

async function queryLocalPartColors(partNum: string) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("part_color_catalog")
    .select("color_name, part_img_url")
    .eq("part_num", partNum)
    .order("color_name", { ascending: true });

  if (error) {
    return null;
  }

  return (data ?? []).map((row) => ({
    color_name: String(row.color_name ?? "").trim(),
    part_img_url: row.part_img_url ? String(row.part_img_url) : null,
  }));
}

async function fetchAndCachePartColors(partNum: string): Promise<CachedColorRow[]> {
  if (!API_KEY) {
    return [];
  }

  const collected: RebrickableColorRow[] = [];
  let nextUrl: string | null = `${API_BASE}/lego/parts/${encodeURIComponent(partNum)}/colors/?${new URLSearchParams({ page_size: "1000" }).toString()}`;

  while (nextUrl) {
    const upstreamResponse = await fetch(nextUrl, {
      headers: {
        Authorization: `key ${API_KEY}`,
      },
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return [];
    }

    const json: { results?: unknown[]; next?: unknown } = await upstreamResponse.json();
    const rows = Array.isArray(json.results) ? (json.results as RebrickableColorRow[]) : [];
    collected.push(...rows);
    nextUrl = json.next ? String(json.next) : null;
  }

  const normalized = collected
    .map((row) => ({
      color_name: String(row.color_name ?? "").trim(),
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
      color_id: row.color_id ? Number(row.color_id) : null,
    }))
    .filter((row) => row.color_name.length > 0);

  const supabase = getServiceSupabase();
  if (supabase && normalized.length > 0) {
    await supabase.from("part_color_catalog").upsert(
      normalized.map((row) => ({
        part_num: partNum,
        color_name: row.color_name,
        part_img_url: row.part_img_url,
        color_id: row.color_id,
      })),
      { onConflict: "part_num,color_name" },
    );
  }

  return normalized.map((row) => ({ color_name: row.color_name, part_img_url: row.part_img_url }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partNum = String(searchParams.get("part_num") || "").trim();
  const colorName = String(searchParams.get("color_name") || "").trim();

  if (!partNum || !colorName) {
    return NextResponse.json({ image_url: null });
  }

  const local = await queryLocalPartColors(partNum);
  if (local && local.length > 0) {
    return NextResponse.json({ image_url: findImage(local, colorName) });
  }

  const fetched = await fetchAndCachePartColors(partNum);

  return NextResponse.json({ image_url: findImage(fetched, colorName) });
}
