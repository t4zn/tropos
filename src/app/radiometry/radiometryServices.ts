import { calculateEpaAqiFromPm25, ExifData } from "./radiometryLogic";

export interface PresetScenario {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  fakeFile: { name: string; size: number };
  exif: ExifData;
  simulatedLuminance: number;
  estimatedSkyPercentage: number;
  presetLocation: { lat: number; lon: number };
}

export interface GroundTruthResult {
  success: boolean;
  isLiveApi: boolean;
  referenceKind: "live" | "preset" | "unavailable";
  locationAvailable: boolean;
  isGeographicallyRelevant: boolean;
  comparisonAvailable: boolean;
  locationSource: string;
  stationName: string;
  agencyName?: string;
  city: string;
  country: string;
  pm25: number | null;
  pm10?: number;
  aqi: number | null;
  aqiCategory: string;
  distanceKm: number | null;
  stationLatitude?: number;
  stationLongitude?: number;
  observationTimestamp?: string;
  referenceTimestamp?: string;
  lastUpdated: string;
  attribution: string;
  fallbackReason?: string;
}

export interface VisionResult {
  success: boolean;
  isSynthetic: boolean;
  hazeSeverity: string;
  hazeDescription: string;
  estimatedAodTau: number;
  estimatedAqi: number;
  aqiCategory: string;
  cloudCoveragePercent: number;
  cloudType: string;
  aerosolVsCloudConfidence: number;
  skyTurbidityRating: string;
  visualClarity: string;
  radiometricCorroboration: string;
  fallbackReason?: string;
}

export const MAX_CORROBORATION_DISTANCE_KM = 50;

export const KNOWN_CITIES: Record<string, { name: string; lat: number; lon: number }> = {
  "indore": { name: "Vijay Nagar, Indore", lat: 22.7533, lon: 75.8937 },
  "vijay nagar, indore": { name: "Vijay Nagar, Indore", lat: 22.7533, lon: 75.8937 },
  "vijay nagar": { name: "Vijay Nagar, Indore", lat: 22.7533, lon: 75.8937 },
  "delhi": { name: "Delhi NCR", lat: 28.6139, lon: 77.2090 },
  "anand vihar": { name: "Anand Vihar, Delhi", lat: 28.6469, lon: 77.3160 },
  "gurugram": { name: "Gurugram", lat: 28.4595, lon: 77.0266 },
  "noida": { name: "Noida", lat: 28.6255, lon: 77.3695 },
  "mumbai": { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  "bengaluru": { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  "san francisco": { name: "San Francisco, US", lat: 37.7749, lon: -122.4194 },
  "los angeles": { name: "Los Angeles, US", lat: 34.0522, lon: -118.2437 },
};

export interface ObservationLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  source: "browser-gps" | "exif_gps" | "user_selected" | "preset_demo";
  localityName?: string;
}

export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function formatMinutesAgo(isoDateStr?: string): string {
  if (!isoDateStr) return "recently";
  const time = new Date(isoDateStr).getTime();
  if (Number.isNaN(time)) return "recently";
  const diffMs = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<string> {
  if (!isValidCoordinate(lat, lon)) {
    return "Invalid coordinates";
  }

  // 1. Regional proximity match to known hubs (instant & offline-resilient)
  for (const city of Object.values(KNOWN_CITIES)) {
    const dist = calculateHaversineDistanceKm(lat, lon, city.lat, city.lon);
    if (dist <= 25) {
      return city.name;
    }
  }

  // 2. Client-side reverse geocoding via OpenStreetMap Nominatim with strict timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        address?: {
          suburb?: string;
          neighbourhood?: string;
          residential?: string;
          city?: string;
          town?: string;
          village?: string;
          state?: string;
        };
        display_name?: string;
      };
      const addr = data.address;
      const sub = addr?.suburb || addr?.neighbourhood || addr?.residential;
      const city = addr?.city || addr?.town || addr?.village;
      const state = addr?.state;

      if (sub && city) return `${sub}, ${city}`;
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (data.display_name) {
        return data.display_name.split(",").slice(0, 2).join(",").trim();
      }
    }
  } catch {
    // Ignore network failure and fall through
  }

  return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
}

export interface ResolvedLocation {
  lat: number;
  lon: number;
  source: "exif_gps" | "user_selected" | "browser_geolocation" | "filename_tag";
  label: string;
}

export function resolveObservationLocation(
  exif?: ExifData | null,
  override?: { lat: number; lon: number; name?: string } | null,
  fileName?: string
): ResolvedLocation | null {
  if (override && Number.isFinite(override.lat) && Number.isFinite(override.lon)) {
    return {
      lat: override.lat,
      lon: override.lon,
      source: "user_selected",
      label: override.name || `${override.lat.toFixed(4)}°, ${override.lon.toFixed(4)}°`,
    };
  }

  if (
    exif &&
    typeof exif.parsed.gpsLatitude === "number" &&
    typeof exif.parsed.gpsLongitude === "number" &&
    Number.isFinite(exif.parsed.gpsLatitude) &&
    Number.isFinite(exif.parsed.gpsLongitude)
  ) {
    return {
      lat: exif.parsed.gpsLatitude,
      lon: exif.parsed.gpsLongitude,
      source: "exif_gps",
      label: exif.parsed.gpsDisplay || `${exif.parsed.gpsLatitude.toFixed(4)}°, ${exif.parsed.gpsLongitude.toFixed(4)}°`,
    };
  }

  if (fileName) {
    const lower = fileName.toLowerCase();
    for (const [key, city] of Object.entries(KNOWN_CITIES)) {
      if (lower.includes(key)) {
        return {
          lat: city.lat,
          lon: city.lon,
          source: "filename_tag",
          label: city.name,
        };
      }
    }
  }

  if (typeof window !== "undefined") {
    const savedCity = localStorage.getItem("tropos_selected_city")?.toLowerCase().trim();
    if (savedCity && KNOWN_CITIES[savedCity]) {
      const c = KNOWN_CITIES[savedCity];
      return { lat: c.lat, lon: c.lon, source: "user_selected", label: c.name };
    }
    const savedLoc = localStorage.getItem("tropos_location");
    if (savedLoc) {
      try {
        const parsed = JSON.parse(savedLoc);
        if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
          return {
            lat: parsed.lat,
            lon: parsed.lon,
            source: "user_selected",
            label: parsed.name || `${parsed.lat.toFixed(4)}°, ${parsed.lon.toFixed(4)}°`,
          };
        }
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

const PRESET_LOCATIONS = [
  { name: "Anand Vihar, Delhi - DPCC", city: "Delhi", country: "IN", latitude: 28.6139, longitude: 77.209, pm25: 142.5, pm10: 268, aqi: 196, aqiCategory: "Unhealthy", attribution: "Delhi Pollution Control Committee (DPCC) via OpenAQ" },
  { name: "Los Angeles - North Main Street", city: "Los Angeles", country: "US", latitude: 34.0522, longitude: -118.2437, pm25: 23.4, pm10: 45.1, aqi: 75, aqiCategory: "Moderate", attribution: "South Coast Air Quality Management District via OpenAQ" },
  { name: "San Francisco - Arkansas Street", city: "San Francisco", country: "US", latitude: 37.7749, longitude: -122.4194, pm25: 6.8, pm10: 14.2, aqi: 28, aqiCategory: "Good", attribution: "Bay Area Air Quality Management District via OpenAQ" },
];

function createSkyDataUrl(topColor: string, bottomColor: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${topColor}"/><stop offset="1" stop-color="${bottomColor}"/></linearGradient></defs><rect width="600" height="400" fill="url(#sky)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function presetExif(make: string, model: string, fNumber: number, software: string, latitude: number, longitude: number): ExifData {
  const now = new Date();
  return { hasExif: true, warnings: [], parsed: { make, model, fNumber, iso: 100, exposureTime: 0.001, exposureTimeDisplay: "1/1000s (0.001s)", dateTimeOriginal: now, dateTimeOriginalDisplay: now.toLocaleString(), software, gpsLatitude: latitude, gpsLongitude: longitude, gpsDisplay: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°` } };
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  { id: "clear-sky", title: "Pristine clear sky", description: "Minimal aerosol attenuation with authentic Sony α7 IV telemetry.", previewUrl: createSkyDataUrl("#2563eb", "#60a5fa"), fakeFile: { name: "clear_sky_zenith_sony_a7iv.jpg", size: 4.8 * 1024 * 1024 }, exif: presetExif("Sony", "ILCE-7M4 (Sony α7 IV)", 5.6, "ILCE-7M4 firmware", 37.7749, -122.4194), simulatedLuminance: 195, estimatedSkyPercentage: 85, presetLocation: { lat: 37.7749, lon: -122.4194 } },
  { id: "moderate-haze", title: "Moderate haze", description: "Thin aerosol scattering with Canon EOS R6 telemetry.", previewUrl: createSkyDataUrl("#7dd3fc", "#bae6fd"), fakeFile: { name: "moderate_haze_canon_eos_r6.jpg", size: 3.9 * 1024 * 1024 }, exif: presetExif("Canon", "EOS R6", 5, "EOS R6 firmware", 34.0522, -118.2437), simulatedLuminance: 200, estimatedSkyPercentage: 82, presetLocation: { lat: 34.0522, lon: -118.2437 } },
  { id: "urban-smog", title: "Urban smog", description: "Dense aerosol extinction with iPhone 15 Pro telemetry.", previewUrl: createSkyDataUrl("#94a3b8", "#cbd5e1"), fakeFile: { name: "hazy_afternoon_delhi_iphone15.jpg", size: 3.2 * 1024 * 1024 }, exif: presetExif("Apple", "iPhone 15 Pro", 4, "iOS 18.1", 28.6139, 77.209), simulatedLuminance: 195, estimatedSkyPercentage: 78, presetLocation: { lat: 28.6139, lon: 77.209 } },
  { id: "spoofed-photo", title: "Tampered smoke capture", description: "A deliberately altered photo with an editor signature.", previewUrl: createSkyDataUrl("#475569", "#334155"), fakeFile: { name: "dense_wildfire_smoke_edited.jpg", size: 0.8 * 1024 * 1024 }, exif: { hasExif: true, warnings: [], parsed: { make: null, model: null, fNumber: 4, iso: 200, exposureTime: 0.002, exposureTimeDisplay: "1/500s (0.002s)", dateTimeOriginal: null, dateTimeOriginalDisplay: "N/A", software: "Adobe Photoshop 2024", gpsLatitude: null, gpsLongitude: null, gpsDisplay: "N/A" } }, simulatedLuminance: 160, estimatedSkyPercentage: 65, presetLocation: { lat: 28.6139, lon: 77.209 } },
];

export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    typeof lat1 !== "number" || !Number.isFinite(lat1) ||
    typeof lon1 !== "number" || !Number.isFinite(lon1) ||
    typeof lat2 !== "number" || !Number.isFinite(lat2) ||
    typeof lon2 !== "number" || !Number.isFinite(lon2)
  ) {
    return NaN;
  }
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371 * c * 10) / 10;
}

export function findClosestPresetLocation(latitude: number, longitude: number) {
  return PRESET_LOCATIONS.reduce((closest, candidate) =>
    calculateHaversineDistanceKm(latitude, longitude, candidate.latitude, candidate.longitude) <
    calculateHaversineDistanceKm(latitude, longitude, closest.latitude, closest.longitude)
      ? candidate
      : closest,
    PRESET_LOCATIONS[0]
  );
}

function presetGroundTruth(latitude?: number, longitude?: number, reason?: string): GroundTruthResult {
  const station =
    typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? findClosestPresetLocation(latitude, longitude)
      : PRESET_LOCATIONS[0];

  return {
    success: true,
    isLiveApi: false,
    referenceKind: "preset",
    locationAvailable: false,
    isGeographicallyRelevant: false,
    comparisonAvailable: false,
    locationSource: "preset_demo",
    stationName: station.name,
    city: station.city,
    country: station.country,
    pm25: station.pm25,
    pm10: station.pm10,
    aqi: station.aqi,
    aqiCategory: station.aqiCategory,
    distanceKm: null,
    stationLatitude: station.latitude,
    stationLongitude: station.longitude,
    lastUpdated: new Date().toISOString(),
    attribution: station.attribution,
    fallbackReason: reason || "Preset fallback reference; not geographically representative of the current observation.",
  };
}

export function unavailableGroundTruth(locationSource: string, reason?: string, observationTimestamp?: string): GroundTruthResult {
  return {
    success: false,
    isLiveApi: false,
    referenceKind: "unavailable",
    locationAvailable: locationSource === "exif_gps" || locationSource === "user_selected" || locationSource === "browser_geolocation" || locationSource === "filename_tag",
    isGeographicallyRelevant: false,
    comparisonAvailable: false,
    locationSource,
    stationName: "No nearby reference station available",
    city: "",
    country: "",
    pm25: null,
    aqi: null,
    aqiCategory: "Unavailable",
    distanceKm: null,
    observationTimestamp,
    lastUpdated: new Date().toISOString(),
    attribution: "OpenAQ Global Community Air Quality Database (v3 API)",
    fallbackReason: reason || "No geographically representative OpenAQ station was found for this observation.",
  };
}

export function getPresetGroundTruth(latitude?: number, longitude?: number) {
  return presetGroundTruth(latitude, longitude);
}

export async function fetchAirQualityForObservation(
  location: ResolvedLocation | ObservationLocation | null,
  observationTimestamp?: string
): Promise<GroundTruthResult> {
  const lat = location && "latitude" in location ? location.latitude : (location as ResolvedLocation)?.lat;
  const lon = location && "longitude" in location ? location.longitude : (location as ResolvedLocation)?.lon;
  const source = location?.source || "missing_location";

  if (!isValidCoordinate(lat, lon)) {
    return unavailableGroundTruth(
      source,
      "No geographically representative OpenAQ station was found for this observation.",
      observationTimestamp
    );
  }

  try {
    const url = new URL("/api/radiometry/openaq", window.location.origin);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("radius", `${MAX_CORROBORATION_DISTANCE_KM * 1000}`);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    window.clearTimeout(timeout);

    if (!response.ok) {
      return unavailableGroundTruth(
        source,
        "No geographically representative OpenAQ station was found for this observation.",
        observationTimestamp
      );
    }

    const json = (await response.json()) as {
      results?: Array<{
        name?: string;
        locality?: string;
        city?: string;
        country?: { code?: string };
        coordinates?: { latitude?: number; longitude?: number };
        sensors?: Array<{ parameter?: { name?: string }; latest?: { value?: number; datetime?: { utc?: string } } }>;
        datetimeLast?: { utc?: string };
      }>;
    };

    const candidates = (json.results || [])
      .filter((candidate) =>
        typeof candidate.coordinates?.latitude === "number" &&
        Number.isFinite(candidate.coordinates.latitude) &&
        typeof candidate.coordinates?.longitude === "number" &&
        Number.isFinite(candidate.coordinates.longitude)
      )
      .map((candidate) => ({
        candidate,
        distance: calculateHaversineDistanceKm(lat!, lon!, candidate.coordinates!.latitude!, candidate.coordinates!.longitude!),
      }))
      .filter(({ distance }) => Number.isFinite(distance) && distance <= MAX_CORROBORATION_DISTANCE_KM)
      .sort((left, right) => left.distance - right.distance);

    const selected = candidates.find(({ candidate }) =>
      candidate.sensors?.some((sensor) => sensor.parameter?.name?.toLowerCase() === "pm25" && Number.isFinite(sensor.latest?.value))
    );

    if (!selected) {
      return unavailableGroundTruth(
        source,
        "No geographically representative OpenAQ station was found for this observation.",
        observationTimestamp
      );
    }

    const station = selected.candidate;
    let pm25: number | null = null;
    let pm10: number | null = null;
    let referenceTimestamp = station.datetimeLast?.utc;

    for (const sensor of station.sensors || []) {
      const parameter = sensor.parameter?.name?.toLowerCase();
      if (parameter === "pm25" && sensor.latest?.value != null) {
        pm25 = Number(sensor.latest.value);
        referenceTimestamp ||= sensor.latest.datetime?.utc;
      }
      if (parameter === "pm10" && sensor.latest?.value != null) {
        pm10 = Number(sensor.latest.value);
      }
    }

    if (pm25 === null || !Number.isFinite(pm25)) {
      return unavailableGroundTruth(source, "No geographically representative OpenAQ station was found for this observation.", observationTimestamp);
    }

    const stationDistance = selected.distance;
    const isGeographicallyRelevant = stationDistance <= MAX_CORROBORATION_DISTANCE_KM;

    let timestampsComparable = false;
    if (observationTimestamp && referenceTimestamp) {
      const diffHours = Math.abs(new Date(observationTimestamp).getTime() - new Date(referenceTimestamp).getTime()) / (1000 * 60 * 60);
      timestampsComparable = diffHours <= 24;
    } else if (referenceTimestamp) {
      const ageHours = Math.abs(Date.now() - new Date(referenceTimestamp).getTime()) / (1000 * 60 * 60);
      timestampsComparable = ageHours <= 48;
    }

    const comparisonAvailable = isGeographicallyRelevant && timestampsComparable;
    const epa = calculateEpaAqiFromPm25(pm25);

    // Identify statutory agency
    let agencyName = "OpenAQ";
    const stationLower = (station.name || "").toLowerCase();
    const localityLower = (station.locality || station.city || "").toLowerCase();
    if (
      stationLower.includes("mppcb") ||
      stationLower.includes("indore") ||
      localityLower.includes("indore") ||
      stationLower.includes("bhopal") ||
      localityLower.includes("bhopal") ||
      stationLower.includes("madhya pradesh")
    ) {
      agencyName = "OpenAQ / MPPCB";
    } else if (
      stationLower.includes("dpcc") ||
      stationLower.includes("delhi") ||
      localityLower.includes("delhi")
    ) {
      agencyName = "OpenAQ / DPCC";
    } else if (
      stationLower.includes("cpcb") ||
      stationLower.includes("central pollution control board")
    ) {
      agencyName = "OpenAQ / CPCB";
    }

    return {
      success: true,
      isLiveApi: true,
      referenceKind: "live",
      locationAvailable: true,
      isGeographicallyRelevant,
      comparisonAvailable,
      locationSource: source,
      stationName: station.name || "Nearby monitoring station",
      agencyName,
      city: station.locality || station.city || "Regional station",
      country: station.country?.code || "Unknown",
      pm25,
      pm10: pm10 ?? undefined,
      aqi: epa.aqi,
      aqiCategory: epa.category,
      distanceKm: stationDistance,
      stationLatitude: station.coordinates!.latitude!,
      stationLongitude: station.coordinates!.longitude!,
      observationTimestamp,
      referenceTimestamp,
      lastUpdated: referenceTimestamp || new Date().toISOString(),
      attribution: `${agencyName} via OpenAQ Database (v3 API)`,
      fallbackReason: !isGeographicallyRelevant
        ? `Station is outside the acceptable radius of ${MAX_CORROBORATION_DISTANCE_KM} km.`
        : !timestampsComparable
        ? "Reference measurement timestamp is not reasonably comparable to the observation."
        : undefined,
    };
  } catch (error) {
    return unavailableGroundTruth(
      source,
      "No geographically representative OpenAQ station was found for this observation.",
      observationTimestamp
    );
  }
}

// Backward compatibility alias
export async function fetchAirQualityForExif(exif: ExifData): Promise<GroundTruthResult> {
  const loc = resolveObservationLocation(exif);
  const ts = exif.parsed.dateTimeOriginal && !Number.isNaN(exif.parsed.dateTimeOriginal.getTime())
    ? exif.parsed.dateTimeOriginal.toISOString()
    : undefined;
  return fetchAirQualityForObservation(loc, ts);
}

export function compareRadiometryWithGroundTruth(radiometryAqi: number, groundTruth: GroundTruthResult) {
  if (
    !groundTruth.comparisonAvailable ||
    groundTruth.referenceKind !== "live" ||
    groundTruth.aqi === null ||
    groundTruth.pm25 === null ||
    groundTruth.distanceKm === null ||
    groundTruth.distanceKm > MAX_CORROBORATION_DISTANCE_KM ||
    !Number.isFinite(radiometryAqi)
  ) {
    return {
      available: false,
      label: "Reference comparison unavailable",
      deltaAqi: null,
      absoluteError: null,
      percentageError: null,
      verdict: "Reference comparison unavailable",
      isDivergent: false,
      divergenceExplanation: undefined,
    };
  }
  const deltaAqi = radiometryAqi - groundTruth.aqi;
  const absoluteError = Math.abs(deltaAqi);
  const percentageError = groundTruth.aqi > 0 ? Math.round((absoluteError / groundTruth.aqi) * 100) : 0;
  const isDivergent = absoluteError > 35;
  const verdict = isDivergent
    ? "Significant local divergence"
    : absoluteError > 15
    ? "Moderate concordance"
    : "High concordance";
  const divergenceExplanation = isDivergent
    ? "Camera-derived estimate differs substantially from the nearby monitoring reference."
    : undefined;
  return { available: true, deltaAqi, absoluteError, percentageError, verdict, isDivergent, divergenceExplanation };
}

function syntheticVision(tau: number, aqi: number): VisionResult {
  const severe = tau > 1; const heavy = tau > .6; const moderate = tau > .35;
  return { success: true, isSynthetic: true, hazeSeverity: severe ? "severe" : heavy ? "heavy" : moderate ? "moderate" : tau <= .15 ? "pristine" : "light", hazeDescription: severe ? "Severe particulate extinction is consistent with intense smoke or inversion smog." : moderate ? "Visible aerosol scattering is reducing sky clarity." : "Low aerosol loading with relatively clear sky contrast.", estimatedAodTau: Math.round(tau * 1000) / 1000, estimatedAqi: Math.min(500, Math.max(0, Math.round(aqi))), aqiCategory: aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for Sensitive Groups" : aqi <= 200 ? "Unhealthy" : aqi <= 300 ? "Very Unhealthy" : "Hazardous", cloudCoveragePercent: severe ? 35 : 10, cloudType: severe ? "Overcast" : "Cirrus", aerosolVsCloudConfidence: .88, skyTurbidityRating: severe ? "extreme" : heavy ? "high" : "moderate", visualClarity: `Estimated horizontal optical depth τ = ${tau.toFixed(3)}`, radiometricCorroboration: "Synthetic analysis harmonized with the Beer-Lambert physical estimate.", fallbackReason: "Google Gemma 4 API key not configured; using local demonstration analysis." };
}

async function imageToBase64(file: File) {
  const image = new Image(); const url = URL.createObjectURL(file); image.src = url;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Unable to encode image for Gemma 4.")); });
  const canvas = document.createElement("canvas"); const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale); canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", .85); return { mimeType: "image/jpeg", data: dataUrl.split(",")[1] };
}

export async function analyzeSkyHazeWithGemma(
  file: File,
  radiometry: { opticalDepth: number; aqi: number },
  locationName?: string
): Promise<VisionResult> {
  try {
    const image = await imageToBase64(file);

    // Call secure server-side Gemma 4 Vision API route
    const response = await fetch("/api/radiometry/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: image.data,
        mimeType: image.mimeType,
        opticalDepth: radiometry.opticalDepth,
        aqi: radiometry.aqi,
        locationName: locationName || "India",
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: HTTP ${response.status}`);
    }

    const res = await response.json();

    if (!res.success) {
      return {
        ...syntheticVision(radiometry.opticalDepth, radiometry.aqi),
        fallbackReason: res.fallbackReason || "Google Gemma 4 Vision key not configured",
      };
    }

    return {
      success: true,
      isSynthetic: false,
      hazeSeverity: res.hazeSeverity || "moderate",
      hazeDescription: res.hazeDescription || "Atmospheric aerosol analysis completed.",
      estimatedAodTau: res.estimatedAodTau ?? radiometry.opticalDepth,
      estimatedAqi: res.estimatedAqi ?? radiometry.aqi,
      aqiCategory: res.aqiCategory || "Moderate",
      cloudCoveragePercent: res.cloudCoveragePercent ?? 0,
      cloudType: res.cloudType || "Clear",
      aerosolVsCloudConfidence: res.aerosolVsCloudConfidence ?? 0.85,
      skyTurbidityRating: res.skyTurbidityRating || "moderate",
      visualClarity: res.visualClarity || "Visual clarity analyzed",
      radiometricCorroboration: res.radiometricCorroboration || "Google Gemma 4 visual analysis corroborates physical sensor.",
      fallbackReason: undefined,
    };
  } catch (error) {
    return {
      ...syntheticVision(radiometry.opticalDepth, radiometry.aqi),
      fallbackReason: error instanceof Error ? error.message : "Google Gemma 4 vision unavailable.",
    };
  }
}

export const analyzeSkyHazeWithGemini = analyzeSkyHazeWithGemma;


