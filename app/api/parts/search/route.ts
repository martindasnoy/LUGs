import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SearchResultItem = {
  part_num: string;
  name: string;
  part_img_url: string | null;
  category_id: number | null;
  is_printed?: boolean;
};

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

function normalizeDimensionText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*x\s*/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchTokens(raw: string) {
  const stopwords = new Set(["with", "and", "con", "y", "de", "the", "a", "an", "w"]);
  return normalizeDimensionText(raw)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !stopwords.has(token));
}

function choosePrimaryToken(tokens: string[], normalized: string) {
  if (tokens.length === 0) {
    return normalized;
  }

  const ranked = [...tokens].sort((a, b) => {
    const aHasDigit = /\d/.test(a);
    const bHasDigit = /\d/.test(b);
    if (aHasDigit !== bHasDigit) {
      return aHasDigit ? -1 : 1;
    }
    if (a.length !== b.length) {
      return b.length - a.length;
    }
    return a.localeCompare(b);
  });

  return ranked[0] || normalized;
}

function buildSearchCandidates(tokens: string[], normalized: string) {
  const genericShapeTokens = new Set([
    "tile",
    "plate",
    "brick",
    "slope",
    "round",
    "modified",
    "w",
    "with",
  ]);
  const primary = choosePrimaryToken(tokens, normalized);
  const candidates: string[] = [];
  const push = (value: string) => {
    const clean = String(value)
      .trim()
      .replace(/,/g, " ")
      .replace(/\s+/g, " ");
    if (!clean) {
      return;
    }
    if (!candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  push(primary);
  tokens.forEach((token) => {
    if (!genericShapeTokens.has(token)) {
      push(token);
    }
  });

  for (const token of tokens) {
    if (/^\d+x\d+$/.test(token)) {
      const expanded = token.replace("x", " x ");
      push(expanded);
    }
  }

  if (candidates.length === 0) {
    tokens.forEach((token) => push(token));
  }

  if (candidates.length === 0) {
    push(normalized);
  }

  return candidates.slice(0, 6);
}

function tokenMatchesSearchText(searchText: string, token: string) {
  if (searchText.includes(token)) {
    return true;
  }

  const compactSearch = searchText.replace(/\s+/g, "");
  const compactToken = token.replace(/\s+/g, "");
  return compactSearch.includes(compactToken);
}

function isPrintedPart(part: Pick<SearchResultItem, "part_num" | "name" | "is_printed">) {
  if (typeof part.is_printed === "boolean") {
    return part.is_printed;
  }
  const code = String(part.part_num ?? "").toLowerCase();
  const title = String(part.name ?? "").toLowerCase();
  return /pb|pr|pat/.test(code) || title.includes("pattern") || title.includes("printed");
}

function scoreSearchResult(part: SearchResultItem, normalizedQuery: string, tokens: string[]) {
  const code = part.part_num.toLowerCase();
  const name = part.name.toLowerCase();
  const normalizedName = normalizeDimensionText(name);
  const normalizedSearchText = normalizeDimensionText(`${part.part_num} ${part.name}`);

  let score = 0;
  const queryCode = normalizedQuery.replace(/^#/, "");

  if (code === queryCode) {
    score += 120;
  } else if (code.startsWith(queryCode)) {
    score += 80;
  } else if (code.includes(queryCode)) {
    score += 40;
  }

  if (normalizedName.includes(normalizedQuery)) {
    score += 60;
  } else if (name.includes(normalizedQuery)) {
    score += 40;
  }

  const tokenMatches = tokens.reduce((acc, token) => (tokenMatchesSearchText(normalizedSearchText, token) ? acc + 1 : acc), 0);
  score += tokenMatches * 20;

  if (!isPrintedPart(part)) {
    score += 30;
  }

  if (normalizedName.includes("modulex")) {
    score -= 120;
  }
  if (normalizedName.includes("duplo")) {
    score -= 120;
  }
  if (normalizedName.includes("print") || normalizedName.includes("printed")) {
    score -= 80;
  }
  if (/\bno\.\s*\d+/i.test(name)) {
    score -= 80;
  }

  score += Math.max(0, 30 - Math.min(30, part.name.length));
  return score;
}

function rankAndLimit(rows: SearchResultItem[], query: string, limit: number) {
  const normalizedQuery = normalizeDimensionText(query.startsWith("#") ? query.slice(1).trim() : query.trim());
  const tokens = extractSearchTokens(normalizedQuery);

  const tokenFiltered = rows.filter((part) => {
    const searchText = normalizeDimensionText(`${part.part_num} ${part.name}`);
    return tokens.every((token) => tokenMatchesSearchText(searchText, token));
  });

  return tokenFiltered
    .sort((a, b) => {
      const scoreDiff = scoreSearchResult(b, normalizedQuery, tokens) - scoreSearchResult(a, normalizedQuery, tokens);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      if (a.name.length !== b.name.length) {
        return a.name.length - b.name.length;
      }
      return a.part_num.localeCompare(b.part_num);
    })
    .slice(0, limit);
}

async function searchWithSupabase(query: string, strict: boolean, accessToken?: string | null): Promise<SearchResultItem[]> {
  const supabase = getServiceSupabase(accessToken);
  if (!supabase) {
    return [];
  }

  const normalized = normalizeDimensionText(query.startsWith("#") ? query.slice(1).trim() : query.trim());
  const tokens = extractSearchTokens(normalized);
  const candidates = buildSearchCandidates(tokens, normalized);
  if (candidates.length === 0) {
    return [];
  }

  const merged = new Map<string, SearchResultItem>();
  const desiredPoolSize = strict ? 1200 : 2000;

  for (const token of candidates) {
    let dbQuery = supabase
      .from("parts_catalog")
      .select("part_num, name, part_img_url, part_cat_id")
      .or(`search_text.ilike.%${token}%,part_num.ilike.${token}%`)
      .order("name", { ascending: true })
      .range(0, 1999);

    if (strict) {
      dbQuery = dbQuery
        .not("name", "ilike", "%modulex%")
        .not("name", "ilike", "%duplo%")
        .not("name", "ilike", "%print%")
        .not("name", "ilike", "%printed%")
        .not("name", "imatch", ".*\\mno\\.\\s*\\d+.*")
        .not("part_num", "ilike", "%pb%")
        .not("part_num", "ilike", "%pr%")
        .not("part_num", "ilike", "%pat%");
    }

    const { data } = await dbQuery;
    for (const row of data ?? []) {
      const partNum = String(row.part_num ?? "");
      if (!partNum || merged.has(partNum)) {
        continue;
      }
      merged.set(partNum, {
        part_num: partNum,
        name: String(row.name ?? ""),
        part_img_url: row.part_img_url ? String(row.part_img_url) : null,
        category_id: row.part_cat_id ? Number(row.part_cat_id) : null,
      });
    }

    if (merged.size >= desiredPoolSize) {
      break;
    }
  }

  return Array.from(merged.values());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") || "").trim();
  const limitRaw = Number(searchParams.get("limit") || "20");
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 20));
  const strict = searchParams.get("strict") !== "0";

  if (normalizeDimensionText(q).length < 3) {
    return NextResponse.json({ results: [] });
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const accessToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  const rows = await searchWithSupabase(q, strict, accessToken);

  const deduped = Array.from(new Map(rows.map((row) => [row.part_num, row])).values());
  const ranked = rankAndLimit(deduped, q, limit);

  return NextResponse.json({ results: ranked });
}
