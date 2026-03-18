import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

function getServiceSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase service configuration" }, { status: 500 });
  }

  const resolvedParams = await Promise.resolve(params);
  const themeId = Number(resolvedParams.id ?? 0);
  if (!Number.isFinite(themeId) || themeId <= 0) {
    return NextResponse.json({ error: "Invalid theme id" }, { status: 400 });
  }

  const pageSize = Math.max(1, Math.min(1000, Number(new URL(request.url).searchParams.get("page_size") || "1000")));
  const { data, error } = await supabase
    .from("minifigure_sets_catalog")
    .select("set_num, name, set_img_url, num_parts, year, theme_id")
    .eq("theme_id", themeId)
    .order("name", { ascending: true })
    .limit(pageSize);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).map((row) => ({
    set_num: String(row.set_num ?? ""),
    name: String(row.name ?? ""),
    set_img_url: row.set_img_url ? String(row.set_img_url) : null,
    num_parts: Number(row.num_parts ?? 0),
    year: row.year == null ? null : Number(row.year),
    theme_id: row.theme_id == null ? null : Number(row.theme_id),
  }));

  const filtered = mapped.filter((row) => {
    const name = row.name.toLowerCase();
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

  return NextResponse.json({
    count: filtered.length,
    results: filtered,
  });
}
