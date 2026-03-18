import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Params = {
  params: Promise<{ setNum: string }> | { setNum: string };
};

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

export async function GET(request: NextRequest, { params }: Params) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const accessToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  const supabase = getServiceSupabase(accessToken);
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const resolvedParams = await Promise.resolve(params);
  const setNum = decodeURIComponent(String(resolvedParams.setNum ?? "")).trim();
  if (!setNum) {
    return NextResponse.json({ error: "Invalid set number" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("minifigure_set_parts_catalog")
    .select("part_num, part_name, part_img_url, color_name, quantity")
    .eq("set_num", setNum)
    .order("part_num", { ascending: true })
    .order("color_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? [])
    .map((row) => ({
      part_num: String(row.part_num ?? ""),
      part_name: String(row.part_name ?? ""),
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
      color_name: String(row.color_name ?? ""),
      quantity: Math.max(1, Number(row.quantity ?? 1) || 1),
    }))
    .filter((row) => row.part_num);

  return NextResponse.json({
    count: mapped.length,
    results: mapped,
  });
}
