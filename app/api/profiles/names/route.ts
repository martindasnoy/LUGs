import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const accessToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  const supabase = getServiceSupabase(accessToken);
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
