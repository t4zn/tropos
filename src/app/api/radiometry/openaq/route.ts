import { NextResponse } from "next/server";

/**
 * OpenAQ Ground Truth Proxy
 * 
 * Proxies OpenAQ v3 requests from the server side, eliminating browser CORS
 * restrictions and injecting the secret process.env.OPENAQ_API_KEY.
 * 
 * Usage: GET /api/radiometry/openaq?lat=22.7467&lon=75.8928&radius=50000
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon") || searchParams.get("lng");
  const radius = searchParams.get("radius") || "50000";

  if (!lat || !lon || !Number.isFinite(parseFloat(lat)) || !Number.isFinite(parseFloat(lon))) {
    return NextResponse.json({ error: "Invalid coordinates provided" }, { status: 400 });
  }

  const apiKey = process.env.OPENAQ_API_KEY || "";

  try {
    const url = new URL("https://api.openaq.org/v3/locations");
    url.searchParams.set("coordinates", `${lat},${lon}`);
    url.searchParams.set("radius", radius);
    url.searchParams.set("limit", "10");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[OpenAQ Proxy] OpenAQ returned ${response.status}:`, errText);
      return NextResponse.json(
        { error: `OpenAQ returned ${response.status}`, results: [] },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OpenAQ fetch failed";
    console.error("[OpenAQ Proxy Exception]:", msg);
    return NextResponse.json({ error: msg, results: [] }, { status: 502 });
  }
}
