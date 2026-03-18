import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const API_BASE = process.env.REBRICKABLE_API_BASE_URL || "https://rebrickable.com/api/v3";
const API_KEY = process.env.REBRICKABLE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getServiceSupabase(accessToken?: string | null) {
  const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !supabaseKey) {
    return null;
  }

  return createClient(SUPABASE_URL, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

async function queryLocalCatalog(
  categoryId: number | null,
  query: string,
  page: number,
  pageSize: number,
  accessToken?: string | null,
) {
  const supabase = getServiceSupabase(accessToken);
  if (!supabase) {
    return null;
  }

  let dbQuery = supabase
    .from("parts_catalog")
    .select("part_num, name, part_img_url, part_cat_id", { count: "exact" });

  if (categoryId) {
    dbQuery = dbQuery.eq("part_cat_id", categoryId);
  }

  const trimmed = query.trim();
  if (trimmed) {
    dbQuery = dbQuery.or(`search_text.ilike.%${trimmed}%,part_num.ilike.${trimmed}%`);
  }

  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { data, error, count } = await dbQuery.order("name", { ascending: true }).range(from, to);

  if (error) {
    return null;
  }

  const results = (data ?? []).map((row) => ({
    part_num: String(row.part_num ?? ""),
    name: String(row.name ?? ""),
    part_img_url: row.part_img_url ? String(row.part_img_url) : null,
    category_id: row.part_cat_id ? Number(row.part_cat_id) : null,
  }));

  return {
    count: Number(count ?? 0),
    results,
  };
}

async function upsertFetchedParts(rows: Array<Record<string, unknown>>) {
  const supabase = getServiceSupabase();
  if (!supabase || rows.length === 0) {
    return;
  }

  const payload = rows.map((row) => ({
    part_num: String(row.part_num ?? ""),
    name: String(row.name ?? ""),
    part_cat_id: row.part_cat_id ? Number(row.part_cat_id) : null,
    part_url: row.part_url ? String(row.part_url) : null,
    part_img_url: row.part_img_url ? String(row.part_img_url) : null,
  }));

  await supabase.from("parts_catalog").upsert(payload, { onConflict: "part_num" });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("category_id") ? Number(searchParams.get("category_id")) : null;
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("page_size") || "20");
  const query = searchParams.get("q") || "";
  const localOnly = searchParams.get("local_only") === "1";

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const accessToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  const localResult = await queryLocalCatalog(categoryId, query, page, pageSize, accessToken);
  if (localOnly) {
    return NextResponse.json({
      count: localResult?.count ?? 0,
      next: null,
      previous: null,
      page,
      page_size: pageSize,
      source: "local_only",
      results: localResult?.results ?? [],
    });
  }

  if (localResult && localResult.results.length > 0) {
    return NextResponse.json({
      count: localResult.count,
      next: null,
      previous: null,
      page,
      page_size: pageSize,
      source: "local",
      results: localResult.results,
    });
  }

  if (!API_KEY) {
    return NextResponse.json({
      count: localResult?.count ?? 0,
      next: null,
      previous: null,
      page,
      page_size: pageSize,
      source: "local_empty",
      results: localResult?.results ?? [],
    });
  }

  const upstreamParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  if (categoryId !== null) {
    upstreamParams.set("part_cat_id", String(categoryId));
  }

  if (query.trim()) {
    upstreamParams.set("search", query.trim());
  }

  const upstreamUrl = `${API_BASE}/lego/parts/?${upstreamParams.toString()}`;

  const response = await fetch(upstreamUrl, {
    headers: {
      Authorization: `key ${API_KEY}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    return NextResponse.json({ error: `Rebrickable ${response.status}: ${body}` }, { status: response.status });
  }

  const json = await response.json();
  const results = Array.isArray(json.results) ? json.results : [];

  await upsertFetchedParts(results);

  const mapped = results.map((row: Record<string, unknown>) => ({
    part_num: String(row.part_num ?? ""),
    name: String(row.name ?? ""),
    part_img_url: row.part_img_url ? String(row.part_img_url) : null,
    category_id: row.part_cat_id ? Number(row.part_cat_id) : null,
  }));

  return NextResponse.json({
    count: Number(json.count ?? 0),
    next: json.next ?? null,
    previous: json.previous ?? null,
    page,
    page_size: pageSize,
    source: "rebrickable",
    results: mapped,
  });
}
