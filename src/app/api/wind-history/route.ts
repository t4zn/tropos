import { NextResponse } from "next/server";

/**
 * Wind History API Route
 *
 * Fetches real hourly wind speed, direction, and boundary layer height
 * from Open-Meteo for the past N hours at a given location.
 *
 * 100% Free — No API key required.
 *
 * Usage: GET /api/wind-history?lat=28.6&lng=77.3&hours=6
 */

export interface WindHistoryEntry {
  /** ISO timestamp */
  time: string;
  /** Hours ago from now (0 = most recent) */
  hoursAgo: number;
  /** Wind speed at 10m in km/h */
  windSpeedKmh: number;
  /** Meteorological wind direction in degrees (direction wind blows FROM) */
  windDeg: number;
  /** Planetary boundary layer height in meters */
  boundaryLayerHeight: number;
}

export interface WindHistoryResponse {
  entries: WindHistoryEntry[];
  lat: number;
  lng: number;
  hoursRequested: number;
  fetchedAt: string;
  source: string;
}

// In-memory cache (2-minute TTL, keyed by lat/lng/hours)
const cache = new Map<string, { data: WindHistoryResponse; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "28.6139");
  const lng = parseFloat(searchParams.get("lng") || "77.209");
  const hours = Math.min(12, Math.max(1, parseInt(searchParams.get("hours") || "6")));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  // Round coords to 2 decimal places for cache key
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${hours}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, cacheHit: true });
  }

  try {
    // Open-Meteo: past_hours gives us real historical hourly data
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=wind_speed_10m,wind_direction_10m,boundary_layer_height` +
      `&wind_speed_unit=kmh` +
      `&timezone=auto` +
      `&past_hours=${hours}` +
      `&forecast_hours=0`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }

    const json = await res.json();
    const hourly = json.hourly;

    if (!hourly?.time || !Array.isArray(hourly.time)) {
      throw new Error("Invalid Open-Meteo response structure");
    }

    const now = Date.now();
    const entries: WindHistoryEntry[] = [];

    for (let i = 0; i < hourly.time.length; i++) {
      const timeStr = hourly.time[i];
      const windSpeed = Number(hourly.wind_speed_10m?.[i] ?? 0);
      const windDir = Number(hourly.wind_direction_10m?.[i] ?? 0);
      const blh = Number(hourly.boundary_layer_height?.[i] ?? 500);
      const entryTime = new Date(timeStr).getTime();
      const hoursAgo = Math.max(0, (now - entryTime) / (1000 * 60 * 60));

      entries.push({
        time: timeStr,
        hoursAgo: Math.round(hoursAgo * 10) / 10,
        windSpeedKmh: Math.round(windSpeed * 10) / 10,
        windDeg: Math.round(windDir),
        boundaryLayerHeight: Math.round(blh),
      });
    }

    // Sort newest first (smallest hoursAgo first, e.g. 0 hours ago is latest)
    entries.sort((a, b) => a.hoursAgo - b.hoursAgo);

    const response: WindHistoryResponse = {
      entries,
      lat,
      lng,
      hoursRequested: hours,
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo ERA5/GFS",
    };

    cache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch wind history";
    console.error("[Wind History API Error]:", msg);
    return NextResponse.json(
      { error: msg, source: "open-meteo", timestamp: new Date().toISOString() },
      { status: 502 }
    );
  }
}
