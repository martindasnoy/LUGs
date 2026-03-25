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

function parseUserHash(payload: string) {
  const raw = String(payload || "").trim();
  if (!raw) {
    return null;
  }

  const xmlMatch = raw.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
  const text = String(xmlMatch?.[1] ?? raw).trim();
  if (!text) {
    return null;
  }

  const visited = new Set<unknown>();
  const parseMaybeJson = (value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return trimmed;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  };

  const findHash = (value: unknown): string | null => {
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    const parsed = parseMaybeJson(value);

    if (typeof parsed === "string") {
      const normalized = parsed.trim();
      if (/^[a-z0-9_-]{8,}$/i.test(normalized)) {
        return normalized;
      }
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const directKeys = ["userHash", "userhash", "hash", "result"] as const;
    for (const key of directKeys) {
      const candidate = findHash(obj[key]);
      if (candidate) {
        return candidate;
      }
    }

    const nestedKeys = ["d", "data", "response"] as const;
    for (const key of nestedKeys) {
      const candidate = findHash(obj[key]);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  };

  return findHash(text);
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 500 });
  }

  if (!BRICKSET_API_KEY) {
    return NextResponse.json({ error: "Falta BRICKSET_API_KEY en el servidor." }, { status: 500 });
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos." }, { status: 400 });
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

  const url = new URL("https://brickset.com/api/v3.asmx/login");
  url.searchParams.set("apiKey", BRICKSET_API_KEY);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);

  let bricksetResponse: Response;
  let responseText = "";
  try {
    bricksetResponse = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });
    responseText = await bricksetResponse.text();
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Brickset en este momento." }, { status: 502 });
  }

  const userHash = parseUserHash(responseText);
  if (!bricksetResponse.ok || !userHash) {
    return NextResponse.json({ error: "No se pudo conectar con Brickset. Revisa usuario/contraseña." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ brickset_user_hash: userHash, brickset_username: username })
    .eq("id", authData.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, username });
}
