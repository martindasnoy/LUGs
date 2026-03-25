import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getAccessToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase no esta configurado para desarmar usuario." }, { status: 500 });
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const userId = authData.user.id;

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return NextResponse.json({ error: deleteAuthError.message || "No se pudo desarmar el usuario." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
