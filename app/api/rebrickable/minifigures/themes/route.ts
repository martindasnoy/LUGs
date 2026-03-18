import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getServiceSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase service configuration", count: 0, results: [] }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("minifigure_series_catalog")
    .select("theme_id, name, parent_theme_id, year_from, year_to, set_count")
    .order("year_from", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, count: 0, results: [] }, { status: 500 });
  }

  const rows = (data ?? [])
    .map((row) => ({
      id: Number(row.theme_id ?? 0),
      name: String(row.name ?? ""),
      parent_id: row.parent_theme_id == null ? null : Number(row.parent_theme_id),
      year_from: row.year_from == null ? null : Number(row.year_from),
      year_to: row.year_to == null ? null : Number(row.year_to),
      set_count: Number(row.set_count ?? 0),
    }))
    .filter((row) => row.id > 0 && row.id < 900000 && row.name);

  return NextResponse.json({
    count: rows.length,
    source: "local",
    results: rows,
  });
}
