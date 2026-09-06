import { NextResponse } from "next/server";

/**
 * OpenWeather Atmospheric Conditions API Route
 * Fetches current weather for the corridor center point (Delhi).
 * Used by the INSAT page to show real atmospheric conditions alongside satellite imagery.
 */

interface WeatherApiResponse {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number; // km/h
  windDeg: number;
  windDir: string;
  visibility: number; // meters
  cloudCover: number; // percent
  description: string;
  feelsLike: number;
  boundaryLayerEstimate: number; // meters
  fetchedAt: string;
  source: string;
}

// In-memory cache (5-minute TTL)
let cache: { data: WeatherApiResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function degToCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, cacheHit: true });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENWEATHER_API_KEY not configured", source: "openweather" },
      { status: 500 }
    );
  }

  try {
    // Delhi center coordinates
    const lat = 28.6139;
    const lng = 77.209;

    const wxUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
    const res = await fetch(wxUrl, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenWeather API error (${res.status}): ${errText}`);
    }

    const data = await res.json();

    const temp = Math.round((data.main?.temp ?? 25) * 10) / 10;
    const windSpeedMps = data.wind?.speed ?? 2.5;
    const windSpeedKmH = Math.round(windSpeedMps * 3.6 * 10) / 10;
    const windDeg = Math.round(data.wind?.deg ?? 0);

    // Estimate planetary boundary layer height
    const blh = Math.round(450 + (temp > 25 ? (temp - 25) * 20 : 0) + windSpeedKmH * 8);

    const response: WeatherApiResponse = {
      temperature: temp,
      humidity: Math.round(data.main?.humidity ?? 60),
      pressure: Math.round(data.main?.pressure ?? 1013),
      windSpeed: windSpeedKmH,
      windDeg,
      windDir: degToCardinal(windDeg),
      visibility: data.visibility ?? 10000,
      cloudCover: data.clouds?.all ?? 0,
      description: data.weather?.[0]?.description ?? "clear sky",
      feelsLike: Math.round((data.main?.feels_like ?? temp) * 10) / 10,
      boundaryLayerEstimate: blh,
      fetchedAt: new Date().toISOString(),
      source: "OpenWeather",
    };

    cache = { data: response, timestamp: Date.now() };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch weather data";
    console.error("[Weather API Error]:", msg);

    return NextResponse.json(
      { error: msg, source: "openweather", timestamp: new Date().toISOString() },
      { status: 502 }
    );
  }
}
