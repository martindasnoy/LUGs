import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ names: {} });
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.from(new Set((Array.isArray(body.ids) ? body.ids : []).map((id) => String(id).trim()).filter(Boolean)));

  if (ids.length === 0) {
    return NextResponse.json({ names: {} });
  }

  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const names: Record<string, string> = {};

  (data ?? []).forEach((row) => {
    const id = String(row.id ?? "").trim();
    const fullName = String(row.full_name ?? "").trim();
    if (id && fullName) {
      names[id] = fullName;
    }
  });

  return NextResponse.json({ names });
}
