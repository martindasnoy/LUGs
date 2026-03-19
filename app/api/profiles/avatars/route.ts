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
    return NextResponse.json({ avatars: {} });
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((value) => String(value ?? "").trim()).filter(Boolean))).slice(0, 200)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ avatars: {} });
  }

  const rpcResult = await supabase.rpc("get_profile_avatars_by_ids", { p_ids: ids });
  if (!rpcResult.error) {
    const avatars: Record<string, string> = {};
    const rows = (rpcResult.data ?? []) as Array<Record<string, unknown>>;
    rows.forEach((row) => {
      const id = String(row.id ?? "").trim();
      const avatarKey = String(row.avatar_key ?? "").trim();
      if (id && avatarKey) {
        avatars[id] = avatarKey;
      }
    });
    return NextResponse.json({ avatars });
  }

  const { data } = await supabase.from("profiles").select("id, avatar_key").in("id", ids);
  const avatars: Record<string, string> = {};

  (data ?? []).forEach((row) => {
    const id = String(row.id ?? "").trim();
    const avatarKey = String((row as { avatar_key?: unknown }).avatar_key ?? "").trim();
    if (id && avatarKey) {
      avatars[id] = avatarKey;
    }
  });

  return NextResponse.json({ avatars });
}
