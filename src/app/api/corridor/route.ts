import { NextResponse } from "next/server";
import {
  type CorridorStation,
  type CorridorApiResponse,
  degToCardinal,
  pm25ToIndiaAqi,
} from "@/types/corridor";

/**
 * Known Reference Monitoring Coordinates across the Delhi-NCR Airshed.
 * Clean names without redundant city suffixes.
 */
interface BaseStation {
  id: string;
  name: string;
  provider: string;
  area: string;
  lat: number;
  lng: number;
}

const CORRIDOR_LOCATIONS: BaseStation[] = [
  { id: "DEL-AV-01", name: "Anand Vihar", provider: "OpenWeather", area: "East Delhi", lat: 28.6469, lng: 77.316 },
  { id: "DEL-RKP-03", name: "R K Puram", provider: "OpenWeather", area: "South Delhi", lat: 28.5632, lng: 77.1869 },
  { id: "DEL-PB-04", name: "Punjabi Bagh", provider: "OpenWeather", area: "West Delhi", lat: 28.674, lng: 77.131 },
  { id: "DEL-DTU-06", name: "DTU Rohini", provider: "OpenWeather", area: "North Delhi", lat: 28.75, lng: 77.1113 },
  { id: "DEL-IGI-05", name: "IGI Airport (T3)", provider: "OpenWeather", area: "Airport Corridor", lat: 28.5628, lng: 77.118 },
  { id: "DEL-MM-02", name: "Mandir Marg", provider: "OpenWeather", area: "Central Delhi", lat: 28.6364, lng: 77.2011 },
  { id: "DEL-PSA-07", name: "Pusa", provider: "OpenWeather", area: "Central Delhi", lat: 28.6396, lng: 77.1463 },
  { id: "DEL-BUR-08", name: "Burari Crossing", provider: "OpenWeather", area: "North Delhi", lat: 28.7257, lng: 77.2012 },
  { id: "DEL-AYA-09", name: "Aya Nagar", provider: "OpenWeather", area: "South Delhi", lat: 28.4743, lng: 77.1316 },
  { id: "DEL-SRF-10", name: "Sirifort", provider: "OpenWeather", area: "South Delhi", lat: 28.5504, lng: 77.2159 },
  { id: "UP-NOI-01", name: "Sector 125", provider: "OpenWeather", area: "Noida", lat: 28.5448, lng: 77.3231 },
  { id: "UP-NOI-02", name: "Sector 62", provider: "OpenWeather", area: "Noida", lat: 28.6245, lng: 77.3577 },
  { id: "HAR-GGN-01", name: "Teri Gram", provider: "OpenWeather", area: "Gurugram", lat: 28.4275, lng: 77.1465 },
  { id: "HAR-GGN-02", name: "Vikas Sadan", provider: "OpenWeather", area: "Gurugram", lat: 28.4501, lng: 77.0263 },
  { id: "HAR-FBD-01", name: "Sector 30", provider: "OpenWeather", area: "Faridabad", lat: 28.4417, lng: 77.3217 },
  { id: "UP-GZB-01", name: "Vasundhara", provider: "OpenWeather", area: "Ghaziabad", lat: 28.6603, lng: 77.3573 },
  { id: "UP-GBN-02", name: "Knowledge Park - III", provider: "OpenWeather", area: "Greater Noida", lat: 28.4727, lng: 77.482 },
  { id: "DEL-DWK-11", name: "Dwarka-Sector 8", provider: "OpenWeather", area: "South-West Delhi", lat: 28.571, lng: 77.0719 },
  { id: "DEL-OKH-12", name: "Okhla Phase-2", provider: "OpenWeather", area: "South-East Delhi", lat: 28.5308, lng: 77.2713 },
  { id: "DEL-USE-13", name: "US Embassy", provider: "OpenWeather", area: "Chanakyapuri, Central Delhi", lat: 28.6358, lng: 77.2245 },
];

// In-memory cache (5-minute TTL)
interface CacheEntry {
  data: CorridorApiResponse;
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch Air Pollution and Weather strictly from OpenWeather APIs.
 * No Open-Meteo, no fallback baselines.
 */
async function fetchFromOpenWeather(apiKey: string): Promise<{ stations: CorridorStation[]; sources: string[] }> {
  const stationResults = await Promise.all(
    CORRIDOR_LOCATIONS.map(async (st) => {
      const aqUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${st.lat}&lon=${st.lng}&appid=${apiKey}`;
      const wxUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${st.lat}&lon=${st.lng}&appid=${apiKey}&units=metric`;

      const [aqRes, wxRes] = await Promise.all([
        fetch(aqUrl, { signal: AbortSignal.timeout(8000) }),
        fetch(wxUrl, { signal: AbortSignal.timeout(8000) }),
      ]);

      if (!aqRes.ok) {
        const errText = await aqRes.text().catch(() => "");
        throw new Error(`OpenWeather Air Pollution API error (${aqRes.status}): ${errText}`);
      }
      if (!wxRes.ok) {
        const errText = await wxRes.text().catch(() => "");
        throw new Error(`OpenWeather Weather API error (${wxRes.status}): ${errText}`);
      }

      const aqData = await aqRes.json();
      const wxData = await wxRes.json();

      const item = aqData.list?.[0];
      if (!item?.components) {
        throw new Error(`Invalid OpenWeather Air Pollution payload for ${st.name}`);
      }

      const pm25 = Math.round((item.components.pm2_5 ?? 0) * 10) / 10;
      const pm10 = Math.round((item.components.pm10 ?? 0) * 10) / 10;
      const { aqi, status } = pm25ToIndiaAqi(pm25);

      // OpenWeather wind speed is in m/s; convert to km/h (1 m/s = 3.6 km/h)
      const windSpeedMps = wxData.wind?.speed ?? 2.5;
      const windSpeedKmH = Math.round(windSpeedMps * 3.6 * 10) / 10;
      const windDeg = Math.round(wxData.wind?.deg ?? 0);
      const temp = Math.round((wxData.main?.temp ?? 25) * 10) / 10;
      const humidity = Math.round(wxData.main?.humidity ?? 60);

      // Convective planetary boundary layer estimate based on ground thermal buoyancy
      const boundaryLayerHeight = Math.round(450 + (temp > 25 ? (temp - 25) * 20 : 0) + windSpeedKmH * 8);

      const observationTime = item.dt
        ? new Date(item.dt * 1000).toISOString()
        : new Date().toISOString();

      const station: CorridorStation = {
        id: st.id,
        name: st.name,
        provider: st.provider,
        area: st.area,
        lat: st.lat,
        lng: st.lng,
        aqi,
        pm25,
        pm10,
        windSpeed: windSpeedKmH,
        windDeg,
        windDir: degToCardinal(windDeg),
        boundaryLayerHeight,
        temperature: temp,
        humidity,
        status,
        source: "openweather",
        observationTime,
        updatedAt: new Date().toISOString(),
      };

      return station;
    })
  );

  return {
    stations: stationResults,
    sources: ["openweather-air-pollution", "openweather-weather"],
  };
}

export async function GET() {
  // Check in-memory cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cache.data,
      meta: { ...cache.data.meta, cacheHit: true },
    });
  }

  const openweatherKey = process.env.OPENWEATHER_API_KEY;
  if (!openweatherKey) {
    return NextResponse.json(
      {
        error: "OPENWEATHER_API_KEY is not configured in .env.local",
        source: "openweather",
      },
      { status: 500 }
    );
  }

  try {
    const { stations, sources } = await fetchFromOpenWeather(openweatherKey);

    // Compute corridor-average wind vector
    const avgWindSpeed =
      Math.round(
        (stations.reduce((sum, s) => sum + s.windSpeed, 0) / stations.length) * 10
      ) / 10;
    const avgWindDeg = Math.round(
      stations.reduce((sum, s) => sum + s.windDeg, 0) / stations.length
    );

    const response: CorridorApiResponse = {
      stations,
      wind: {
        speed: avgWindSpeed,
        deg: avgWindDeg,
        dir: degToCardinal(avgWindDeg),
      },
      meta: {
        sources,
        fetchedAt: new Date().toISOString(),
        cacheHit: false,
      },
    };

    // Update cache
    cache = { data: response, timestamp: Date.now() };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch from OpenWeather";
    console.error("[Corridor API Error - OpenWeather Only]:", errorMessage);

    return NextResponse.json(
      {
        error: errorMessage,
        source: "openweather",
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
