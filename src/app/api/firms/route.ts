import { NextResponse } from "next/server";

/**
 * NASA FIRMS VIIRS Active Fire API Route
 * Fetches real-time fire hotspot data for the Indo-Gangetic corridor
 * using the area/csv endpoint with bounding box.
 */

// Indo-Gangetic corridor bounding box: lng_min,lat_min,lng_max,lat_max
const BBOX_PARAM = "75.5,27.5,78.5,30.5";

interface FireHotspot {
  lat: number;
  lng: number;
  brightness: number;
  scan: number;
  track: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: string;
  frp: number;
  daynight: string;
}

interface FirmsApiResponse {
  fires: FireHotspot[];
  corridorFireCount: number;
  fetchedAt: string;
  source: string;
}

// In-memory cache (5-minute TTL)
let cache: { data: FirmsApiResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, cacheHit: true });
  }

  const firmsKey = process.env.NASA_FIRMS_KEY;
  if (!firmsKey) {
    return NextResponse.json(
      {
        error: "NASA_FIRMS_KEY is not configured in .env.local. Get a free key at https://firms.modaps.eosdis.nasa.gov/api/map_key/",
        source: "firms",
      },
      { status: 500 }
    );
  }

  try {
    // area/csv endpoint: /api/area/csv/{MAP_KEY}/{SENSOR}/{BBOX}/{DAY_RANGE}
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${firmsKey}/VIIRS_SNPP_NRT/${BBOX_PARAM}/1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`FIRMS API error (${res.status}): ${errText}`);
    }

    const csvText = await res.text();
    const lines = csvText.trim().split("\n");

    if (lines.length < 1) {
      throw new Error("FIRMS returned empty response");
    }

    // Parse CSV header
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const latIdx = headers.indexOf("latitude");
    const lngIdx = headers.indexOf("longitude");
    const brightIdx = headers.indexOf("bright_ti4");
    const scanIdx = headers.indexOf("scan");
    const trackIdx = headers.indexOf("track");
    const dateIdx = headers.indexOf("acq_date");
    const timeIdx = headers.indexOf("acq_time");
    const satIdx = headers.indexOf("satellite");
    const confIdx = headers.indexOf("confidence");
    const frpIdx = headers.indexOf("frp");
    const dnIdx = headers.indexOf("daynight");

    const fires: FireHotspot[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 5) continue;

      const lat = parseFloat(cols[latIdx]);
      const lng = parseFloat(cols[lngIdx]);
      if (isNaN(lat) || isNaN(lng)) continue;

      fires.push({
        lat,
        lng,
        brightness: parseFloat(cols[brightIdx]) || 0,
        scan: parseFloat(cols[scanIdx]) || 0,
        track: parseFloat(cols[trackIdx]) || 0,
        acqDate: cols[dateIdx] || "",
        acqTime: cols[timeIdx] || "",
        satellite: cols[satIdx] || "VIIRS",
        confidence: cols[confIdx] || "nominal",
        frp: parseFloat(cols[frpIdx]) || 0,
        daynight: cols[dnIdx] || "",
      });
    }

    const response: FirmsApiResponse = {
      fires,
      corridorFireCount: fires.length,
      fetchedAt: new Date().toISOString(),
      source: "NASA FIRMS VIIRS S-NPP NRT",
    };

    cache = { data: response, timestamp: Date.now() };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch FIRMS data";
    console.error("[FIRMS API Error]:", msg);

    return NextResponse.json(
      { error: msg, source: "firms", timestamp: new Date().toISOString() },
      { status: 502 }
    );
  }
}
