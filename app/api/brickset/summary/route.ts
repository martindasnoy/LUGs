import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BRICKSET_API_KEY = process.env.BRICKSET_API_KEY;

function getAccessToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

function extractJsonLikeString(value: string) {
  const xmlMatch = value.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
  if (xmlMatch?.[1]) {
    return xmlMatch[1].trim();
  }
  return value.trim();
}

function parseBricksetPayload(raw: string): Record<string, unknown> | null {
  const first = extractJsonLikeString(raw);
  if (!first) {
    return null;
  }

  const parseAny = (input: string): unknown => {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  const p1 = parseAny(first);
  if (p1 && typeof p1 === "object" && !Array.isArray(p1)) {
    return p1 as Record<string, unknown>;
  }

  if (typeof p1 === "string") {
    const p2 = parseAny(p1);
    if (p2 && typeof p2 === "object" && !Array.isArray(p2)) {
      return p2 as Record<string, unknown>;
    }
  }

  return null;
}

function parseOwnedSetsCount(payload: Record<string, unknown>): number | null {
  const directKeys = ["matches", "matchCount", "total", "count", "resultsCount"] as const;
  for (const key of directKeys) {
    const value = payload[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  const setsValue = payload.sets;
  if (Array.isArray(setsValue)) {
    return setsValue.length;
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 500 });
  }
  if (!BRICKSET_API_KEY) {
    return NextResponse.json({ error: "Falta BRICKSET_API_KEY en servidor." }, { status: 500 });
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("brickset_user_hash, brickset_username")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const userHash = String((profileData as { brickset_user_hash?: unknown } | null)?.brickset_user_hash ?? "").trim();
  const username = String((profileData as { brickset_username?: unknown } | null)?.brickset_username ?? "").trim();
  if (!userHash) {
    return NextResponse.json({ connected: false, username: username || null, owned_sets_count: null });
  }

  const params = JSON.stringify({ owned: 1, pageNumber: 1, pageSize: 1 });
  const url = new URL("https://brickset.com/api/v3.asmx/getSets");
  url.searchParams.set("apiKey", BRICKSET_API_KEY);
  url.searchParams.set("userHash", userHash);
  url.searchParams.set("params", params);

  const bricksetResponse = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const responseText = await bricksetResponse.text();
  if (!bricksetResponse.ok) {
    return NextResponse.json({ error: "No se pudo consultar Brickset." }, { status: 502 });
  }

  const payload = parseBricksetPayload(responseText);
  if (!payload) {
    return NextResponse.json({ connected: true, username: username || null, owned_sets_count: null });
  }

  const ownedSetsCount = parseOwnedSetsCount(payload);
  return NextResponse.json({ connected: true, username: username || null, owned_sets_count: ownedSetsCount });
}
