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

function normalizeColorLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^lego:\s*/i, "")
    .replace(/^bricklink:\s*/i, "")
    .replace(/\(chino\)/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getPartImageKey(partNum: string, colorName: string | null | undefined) {
  const normalizedColor = String(colorName ?? "").trim().toLowerCase();
  return `${partNum.trim()}::${normalizedColor}`;
}

type RequestItem = {
  part_num: string;
  color_name: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ results: [] });
  }

  const body = (await request.json().catch(() => ({}))) as { items?: RequestItem[] };
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const uniquePartNums = Array.from(new Set(items.map((item) => String(item.part_num || "").trim()).filter(Boolean)));

  const [{ data: colorRows }, { data: baseRows }] = await Promise.all([
    supabase.from("part_color_catalog").select("part_num, color_name, part_img_url").in("part_num", uniquePartNums),
    supabase.from("parts_catalog").select("part_num, part_img_url").in("part_num", uniquePartNums),
  ]);

  const colorsByPart = new Map<string, Array<{ color_name: string; part_img_url: string | null }>>();
  (colorRows ?? []).forEach((row) => {
    const partNum = String(row.part_num ?? "").trim();
    const colorName = String(row.color_name ?? "").trim();
    if (!partNum || !colorName) {
      return;
    }
    if (!colorsByPart.has(partNum)) {
      colorsByPart.set(partNum, []);
    }
    colorsByPart.get(partNum)?.push({
      color_name: colorName,
      part_img_url: row.part_img_url ? String(row.part_img_url) : null,
    });
  });

  const baseByPart = new Map<string, string | null>();
  (baseRows ?? []).forEach((row) => {
    const partNum = String(row.part_num ?? "").trim();
    if (!partNum) {
      return;
    }
    baseByPart.set(partNum, row.part_img_url ? String(row.part_img_url) : null);
  });

  const results = items.map((item) => {
    const partNum = String(item.part_num || "").trim();
    const normalizedTarget = normalizeColorLabel(item.color_name);
    const partColors = colorsByPart.get(partNum) ?? [];

    let colorImage: string | null = null;
    if (normalizedTarget) {
      const exact = partColors.find((row) => normalizeColorLabel(row.color_name) === normalizedTarget);
      if (exact?.part_img_url) {
        colorImage = exact.part_img_url;
      } else {
        const partial = partColors.find((row) => {
          const current = normalizeColorLabel(row.color_name);
          return current.includes(normalizedTarget) || normalizedTarget.includes(current);
        });
        colorImage = partial?.part_img_url ?? null;
      }
    }

    const fallback = baseByPart.get(partNum) ?? null;
    return {
      key: getPartImageKey(partNum, item.color_name),
      part_num: partNum,
      part_img_url: colorImage || fallback,
    };
  });

  return NextResponse.json({ results });
}
