import { NextRequest, NextResponse } from "next/server";

type Place = {
  id: string;
  name: string;
  category: string;
  address?: string;
  lat: number;
  lng: number;
};

type KakaoPlaceDocument = {
  id?: string;
  place_id?: string;
  place_name?: string;
  name?: string;
  category_name?: string;
  category?: string;
  road_address_name?: string;
  address_name?: string;
  x: string;
  y: string;
};

type KakaoSearchResponse = {
  documents?: KakaoPlaceDocument[];
  meta?: unknown;
};

// Resolve Kakao REST key from a few common env names
function getKakaoKey(): string | null {
  return (
    process.env.KAKAO_REST_API_KEY ||
    process.env.KAKAO_API_KEY ||
    process.env.KAKAO_LOCAL_REST_API_KEY ||
    process.env.KAKAO_REST_KEY ||
    null
  );
}

/**
 * GET /api/places
 * Query params:
 *  - q: keyword
 *  - lat, lng: center coords (WGS84)
 *  - radius: optional meters (default 1500, max 20000 per Kakao)
 *  - page, size: optional pagination (defaults page=1,size=15)
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") || "NaN");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") || "NaN");
  const radius = Math.min(
    20000,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("radius") || "1500", 10)),
  );
  const page = Math.max(
    1,
    parseInt(req.nextUrl.searchParams.get("page") || "1", 10),
  );
  const size = Math.min(
    45,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("size") || "15", 10)),
  );

  if (!query) {
    return NextResponse.json(
      { error: "q is required (검색어)" },
      { status: 400 },
    );
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat,lng are required" },
      { status: 400 },
    );
  }

  const KAKAO_KEY = getKakaoKey();
  if (!KAKAO_KEY) {
    return NextResponse.json(
      { error: "Server key missing: set KAKAO_REST_API_KEY" },
      { status: 500 },
    );
  }

  // Kakao Local Keyword Search (radius). Note: x=lng, y=lat per Kakao docs.
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("x", String(lng));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  url.searchParams.set("sort", "distance");

  const r = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${KAKAO_KEY}`,
      Accept: "application/json",
    },
  });

  if (!r.ok) {
    let payload: unknown = null;
    try {
      payload = await r.json();
    } catch {}
    return NextResponse.json(
      { error: "Kakao Local search failed", raw: payload },
      { status: r.status },
    );
  }

  const data = (await r.json()) as KakaoSearchResponse;
  const docs: KakaoPlaceDocument[] = Array.isArray(data?.documents)
    ? data.documents
    : [];
  const results: Place[] = docs.map((d) => ({
    id: String(d?.id ?? d?.place_id ?? `${d?.x}-${d?.y}`),
    name: String(d?.place_name ?? d?.name ?? "").trim(),
    category: String(d?.category_name ?? d?.category ?? "").trim(),
    address:
      String(d?.road_address_name || d?.address_name || "").trim() || undefined,
    lat: parseFloat(d?.y), // Kakao returns y(lat), x(lng) as strings
    lng: parseFloat(d?.x),
  }));

  return NextResponse.json({ results, meta: data?.meta ?? null });
}
