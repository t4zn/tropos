/**
 * Tropos Corridor Types — Shared type definitions for live air quality data.
 * These types are used by the API route, the data hook, and the map component.
 */

export interface CorridorStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** India National AQI (0–500+) */
  aqi: number;
  /** PM2.5 in µg/m³ */
  pm25: number;
  /** PM10 in µg/m³ */
  pm10: number;
  /** Wind speed in km/h */
  windSpeed: number;
  /** Wind direction in degrees (meteorological: 0=N, 90=E, 180=S, 270=W) */
  windDeg: number;
  /** Wind direction cardinal label */
  windDir: string;
  /** Planetary boundary layer height in meters */
  boundaryLayerHeight: number;
  /** Temperature in °C */
  temperature: number;
  /** Relative humidity in % */
  humidity: number;
  /** AQI severity category */
  status: "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";
  /** Data source label */
  source: "open-meteo" | "google" | "openaq" | "openweather" | "fallback";
  /** Network/Provider name (e.g. CPCB, DPCC, IMD, US Embassy) */
  provider?: string;
  /** Sub-region or city area (e.g. Delhi, Noida, Gurugram, Faridabad, Ghaziabad) */
  area?: string;
  /** ISO timestamp of direct sensor telemetry observation */
  observationTime?: string;
  /** ISO timestamp of data retrieval */
  updatedAt: string;
}

export interface CorridorApiResponse {
  stations: CorridorStation[];
  wind: {
    speed: number;
    deg: number;
    dir: string;
  };
  meta: {
    sources: string[];
    fetchedAt: string;
    cacheHit: boolean;
  };
}

/**
 * Convert degrees to cardinal direction label.
 */
export function degToCardinal(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/**
 * Compute India National AQI from PM2.5 concentration.
 * Based on CPCB breakpoint table.
 */
export function pm25ToIndiaAqi(pm25: number): { aqi: number; status: CorridorStation["status"] } {
  const breakpoints: [number, number, number, number, CorridorStation["status"]][] = [
    [0, 30, 0, 50, "Good"],
    [30, 60, 51, 100, "Satisfactory"],
    [60, 90, 101, 200, "Moderate"],
    [90, 120, 201, 300, "Poor"],
    [120, 250, 301, 400, "Very Poor"],
    [250, 500, 401, 500, "Severe"],
  ];

  for (const [cLow, cHigh, iLow, iHigh, status] of breakpoints) {
    if (pm25 >= cLow && pm25 <= cHigh) {
      const aqi = Math.round(((iHigh - iLow) / (cHigh - cLow)) * (pm25 - cLow) + iLow);
      return { aqi, status };
    }
  }

  return { aqi: Math.min(999, Math.round(pm25 * 1.5)), status: "Severe" };
}
