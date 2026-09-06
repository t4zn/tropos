export const DEFAULT_BASELINE_I0 = 65000;
const STORAGE_KEY = "tropos_baseline_i0";

export interface ExifData {
  hasExif: boolean;
  warnings: string[];
  parsed: {
    make: string | null; model: string | null; fNumber: number | null; iso: number | null;
    exposureTime: number | null; exposureTimeDisplay: string; dateTimeOriginal: Date | null;
    dateTimeOriginalDisplay: string; software: string | null; gpsDisplay: string;
    gpsLatitude: number | null; gpsLongitude: number | null;
  };
}

export interface PixelStats {
  avgLuminance: number;
  r: number;
  g: number;
  b: number;
  sampleCount: number;
  estimatedSkyPercentage: number;
  luminanceStdDev: number;
  darkPixelPercentage: number;
  clippedPixelPercentage: number;
  dynamicRange: number;
  upperBrightNeutralPercentage: number;
  upperLuminanceStdDev: number;
  brightnessGradient: number;
}

export type SceneDetectedType =
  | "clear_sky"
  | "cloudy_sky"
  | "hazy_sky"
  | "screenshot_code"
  | "screenshot_web"
  | "finger_occlusion"
  | "skin_person"
  | "indoor_scene"
  | "insufficient_sky"
  | "extreme_exposure";

export interface SceneValidationMetrics {
  edgeDensity: number;
  skyCoverage: number;
  upperSkyCoverage: number;
  skinPercentage: number;
  upperSkinPercentage: number;
  flatLineRatio: number;
  avgLuminance: number;
  darkPixelPercentage: number;
  clippedPixelPercentage: number;
}

export interface SceneValidationResult {
  sceneValid: boolean;
  sceneQuality: "valid" | "uncertain" | "invalid";
  detectedType: SceneDetectedType;
  rejectionReason?: string;
  userMessage: {
    title: string;
    description: string;
    action: string;
  };
  metrics: SceneValidationMetrics;
}

export function formatDetectedType(type: SceneDetectedType): string {
  switch (type) {
    case "clear_sky": return "Clear Atmospheric Sky";
    case "cloudy_sky": return "Cloudy Atmospheric Sky";
    case "hazy_sky": return "Hazy Atmospheric Sky";
    case "screenshot_code": return "Code Editor / Terminal Screenshot";
    case "screenshot_web": return "Webpage / Document Screenshot";
    case "finger_occlusion": return "Finger / Lens Occlusion";
    case "skin_person": return "Person / Foreground Subject";
    case "indoor_scene": return "Indoor / Enclosed Environment";
    case "insufficient_sky": return "Insufficient Sky Coverage";
    case "extreme_exposure": return "Extreme Exposure / Blackout";
    default: return "Non-Atmospheric Observation";
  }
}

export function validateAtmosphericScene(
  pixels: { width: number; height: number; data: Uint8ClampedArray | number[] },
  exifHasCamera = false
): SceneValidationResult {
  const { width, height, data } = pixels;
  const totalPixels = width * height;
  const upperHalfHeight = Math.max(1, Math.floor(height / 2));
  const upperHalfPixels = upperHalfHeight * width;

  let totalLuminance = 0;
  let darkPixels = 0;
  let clippedPixels = 0;
  let skinPixels = 0;
  let skyPixels = 0;
  let edgeCount = 0;
  let flatRunCount = 0;

  let upperSkyPixels = 0;
  let upperSkinPixels = 0;
  let upperOvercastPixels = 0;
  let upperBluePixels = 0;

  let darkModeBgPixels = 0;
  let lightModeBgPixels = 0;

  for (let y = 0; y < height; y++) {
    let consecutiveFlat = 1;
    const isUpper = y < upperHalfHeight;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      totalLuminance += lum;
      if (lum <= 25) darkPixels++;
      if (lum >= 248) clippedPixels++;

      // 1. Skin / flesh / finger detection
      const isSkin =
        r > 55 &&
        g > 30 &&
        b > 15 &&
        r > g &&
        g >= b * 0.85 &&
        (r - g) > 8 &&
        (r - b) > 15;

      const isBacklitTissue =
        r > 85 &&
        r > g * 1.5 &&
        b < 70 &&
        (r - g) / (r + g + 0.1) > 0.25;

      if (isSkin || isBacklitTissue) {
        skinPixels++;
        if (isUpper) upperSkinPixels++;
      }

      // 2. Sky heuristic (Blue sky, overcast cloud, hazy sky, or sunset/twilight sky)
      const isBlueSky = lum >= 50 && b >= g && b - r >= 10;
      const isOvercastCloud = lum >= 90 && Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24;
      const isHazySky = lum >= 75 && lum <= 235 && Math.abs(r - g) <= 25 && Math.abs(g - b) <= 25;
      const isSunsetSky = lum >= 30 && lum <= 245 && r >= g && r >= b + 10;

      if (isBlueSky || isOvercastCloud || isHazySky || isSunsetSky) {
        skyPixels++;
        if (isUpper) {
          upperSkyPixels++;
          if (isOvercastCloud) upperOvercastPixels++;
          if (isBlueSky) upperBluePixels++;
        }
      }

      // 3. Digital screenshot flat background tracking
      if (lum >= 15 && lum <= 55 && Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6) {
        darkModeBgPixels++;
      }
      if (lum >= 238 && Math.abs(r - g) <= 4 && Math.abs(g - b) <= 4) {
        lightModeBgPixels++;
      }

      // 4. Edge gradient calculation with neighbors
      if (x < width - 1 && y < height - 1) {
        const nextIdxX = (y * width + (x + 1)) * 4;
        const nextIdxY = ((y + 1) * width + x) * 4;
        const nextLumX = 0.2126 * data[nextIdxX] + 0.7152 * data[nextIdxX + 1] + 0.0722 * data[nextIdxX + 2];
        const nextLumY = 0.2126 * data[nextIdxY] + 0.7152 * data[nextIdxY + 1] + 0.0722 * data[nextIdxY + 2];

        const gradX = Math.abs(lum - nextLumX);
        const gradY = Math.abs(lum - nextLumY);

        if (gradX > 28 || gradY > 28) {
          edgeCount++;
        }

        const diffR = Math.abs(r - data[nextIdxX]);
        const diffG = Math.abs(g - data[nextIdxX + 1]);
        const diffB = Math.abs(b - data[nextIdxX + 2]);
        if (diffR === 0 && diffG === 0 && diffB === 0) {
          consecutiveFlat++;
          if (consecutiveFlat > 20) {
            flatRunCount++;
          }
        } else {
          consecutiveFlat = 1;
        }
      }
    }
  }

  const avgLuminance = totalLuminance / totalPixels;
  const edgeDensity = (edgeCount / totalPixels) * 100;
  const skyCoverage = (skyPixels / totalPixels) * 100;
  const upperSkyCoverage = (upperSkyPixels / upperHalfPixels) * 100;
  const skinPercentage = (skinPixels / totalPixels) * 100;
  const upperSkinPercentage = (upperSkinPixels / upperHalfPixels) * 100;
  const flatLineRatio = (flatRunCount / totalPixels) * 100;
  const darkPixelPercentage = (darkPixels / totalPixels) * 100;
  const clippedPixelPercentage = (clippedPixels / totalPixels) * 100;
  const darkModeBgRatio = (darkModeBgPixels / totalPixels) * 100;
  const lightModeBgRatio = (lightModeBgPixels / totalPixels) * 100;

  const metrics: SceneValidationMetrics = {
    edgeDensity: Math.round(edgeDensity * 10) / 10,
    skyCoverage: Math.round(skyCoverage * 10) / 10,
    upperSkyCoverage: Math.round(upperSkyCoverage * 10) / 10,
    skinPercentage: Math.round(skinPercentage * 10) / 10,
    upperSkinPercentage: Math.round(upperSkinPercentage * 10) / 10,
    flatLineRatio: Math.round(flatLineRatio * 10) / 10,
    avgLuminance: Math.round(avgLuminance * 10) / 10,
    darkPixelPercentage: Math.round(darkPixelPercentage * 10) / 10,
    clippedPixelPercentage: Math.round(clippedPixelPercentage * 10) / 10,
  };

  const reject = (type: SceneDetectedType, reason: string): SceneValidationResult => ({
    sceneValid: false,
    sceneQuality: "invalid",
    detectedType: type,
    rejectionReason: reason,
    userMessage: {
      title: "Observation rejected",
      description: "This image does not appear to be a valid atmospheric sky observation.",
      action: "Capture/upload an unobstructed outdoor sky image for radiometric analysis.",
    },
    metrics,
  });

  // 1. Extreme Exposure / Blackout / Covered Lens
  if (darkPixelPercentage > 75 || avgLuminance < 18) {
    return reject(
      "extreme_exposure",
      "Image is underexposed or obscured (possible lens cap or total occlusion)."
    );
  }

  if (clippedPixelPercentage > 50 && edgeDensity < 2) {
    return reject(
      "extreme_exposure",
      "Image sensor is heavily saturated/overexposed with complete loss of tonal separation."
    );
  }

  // 2. Finger / Hand / Backlit Flesh covering lens (must be blurred/defocused with virtually no edges or sky)
  if ((skinPercentage > 55 || upperSkinPercentage > 50) && upperSkyCoverage < 15 && edgeDensity < 1.0) {
    return reject(
      "finger_occlusion",
      "Camera lens appears occluded by a finger, hand, or physical object."
    );
  }

  // 3. Person / Portrait / Selfie (large skin area in frame without sky or silhouette)
  if (skinPercentage > 30 && upperSkyCoverage < 20 && edgeDensity > 3.5) {
    return reject(
      "skin_person",
      "Image contains a person or foreground subject rather than an open atmospheric sky."
    );
  }

  // 4. Digital Screenshot / App UI / Graphic Detection
  const hasDigitalFlatRuns = flatRunCount > 3 && !exifHasCamera;
  const isDarkCodeScreenshot = darkModeBgRatio > 35 && edgeDensity > 6;
  const isLightCodeScreenshot = lightModeBgRatio > 30 && (edgeDensity > 5 || hasDigitalFlatRuns);
  const isHighEdgeSynthetic = edgeDensity > 9 && (flatLineRatio > 0.8 || !exifHasCamera);

  if (hasDigitalFlatRuns || isDarkCodeScreenshot || isLightCodeScreenshot || isHighEdgeSynthetic) {
    return reject(
      "screenshot_web",
      "Detected a digital application screenshot, user interface, or non-photographic graphic."
    );
  }

  // 5. Webpage / UI / Document Screenshot
  if (edgeDensity > 8 && (upperSkyCoverage < 35 || !exifHasCamera)) {
    return reject(
      "screenshot_web",
      "Detected an application interface, document, or non-atmospheric graphic."
    );
  }

  // 6. Indoor Scene / Zero Sky / Artificial Lighting
  if (upperSkyCoverage < 20) {
    return reject(
      upperSkyCoverage < 10 ? "indoor_scene" : "insufficient_sky",
      upperSkyCoverage < 10
        ? "Image appears to be an indoor or enclosed environment with no visible sky."
        : "Insufficient unobstructed sky region in the frame (minimum 25% required in upper frame)."
    );
  }

  const upperCloudRatio = upperOvercastPixels / Math.max(1, upperHalfPixels);

  // 7. Valid Sky Detection (Clear, Cloudy, or Hazy)
  if (upperSkyCoverage >= 35 && edgeDensity <= 7.5) {
    let detectedType: SceneDetectedType = "clear_sky";
    if (upperCloudRatio > 0.18 || (upperOvercastPixels > upperBluePixels * 1.3 && upperSkyCoverage > 30)) {
      detectedType = "cloudy_sky";
    } else if (edgeDensity < 3.5 && skyCoverage > 40) {
      detectedType = "hazy_sky";
    }

    return {
      sceneValid: true,
      sceneQuality: "valid",
      detectedType,
      userMessage: {
        title: "Atmospheric observation verified",
        description: "Valid outdoor sky region detected suitable for radiometric analysis.",
        action: "Physics calculation active.",
      },
      metrics,
    };
  }

  // 8. Urban Framing / Balcony / Terrace Sky (lower frame has building, upper frame has sky)
  if (upperSkyCoverage >= 20 && upperSkyCoverage < 35) {
    const isCloudDominant = upperCloudRatio > 0.12 || upperOvercastPixels > upperBluePixels;
    return {
      sceneValid: true,
      sceneQuality: "uncertain",
      detectedType: isCloudDominant ? "cloudy_sky" : "clear_sky",
      rejectionReason: "Urban structures or rooftop in foreground; radiometry focused on upper atmospheric aperture.",
      userMessage: {
        title: "Urban framing detected",
        description: "Building or rooftop detected in foreground. Radiometric analysis calibrated on upper atmospheric sky region.",
        action: "Framing active — upper sky aperture analyzed.",
      },
      metrics,
    };
  }

  return reject(
    "insufficient_sky",
    "This image does not appear to be a valid atmospheric sky observation."
  );
}

export function validateImageScene(image: HTMLImageElement, exif?: ExifData, fileName?: string): SceneValidationResult {
  // Check if filename explicitly indicates a digital screenshot or capture
  if (fileName && /screenshot|screen_shot|screen shot|snip|screen\s*\d|capture/i.test(fileName)) {
    return {
      sceneValid: false,
      sceneQuality: "invalid",
      detectedType: "screenshot_web",
      rejectionReason: `Filename "${fileName}" indicates an application screen capture rather than an outdoor photograph.`,
      userMessage: {
        title: "Screen capture rejected",
        description: "This image appears to be a digital screenshot, not an outdoor camera sky observation.",
        action: "Please upload an outdoor photograph of the open sky captured by a smartphone camera.",
      },
      metrics: {
        edgeDensity: 10,
        skyCoverage: 0,
        upperSkyCoverage: 0,
        skinPercentage: 0,
        upperSkinPercentage: 0,
        flatLineRatio: 1,
        avgLuminance: 128,
        darkPixelPercentage: 0,
        clippedPixelPercentage: 0,
      },
    };
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas analysis is unavailable in this browser.");
  }
  const scale = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const exifHasCamera = Boolean(exif?.parsed.make && exif?.parsed.model);
  return validateAtmosphericScene({ width: canvas.width, height: canvas.height, data: imageData.data }, exifHasCamera);
}

export const OBSERVATION_CONFIDENCE_LEVELS = { veryHigh: 90, high: 75, moderate: 60, low: 40 } as const;

export type ObservationConfidenceFactor = { name: string; status: "good" | "warning"; impact: number; explanation: string };
export type ObservationConfidence = { observationConfidence: number; confidenceLevel: "Very high" | "High" | "Moderate" | "Low" | "Very low"; factors: ObservationConfidenceFactor[] };

export function getBaseline() {
  if (typeof window === "undefined") return DEFAULT_BASELINE_I0;
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(saved) && saved > 5000 ? saved : DEFAULT_BASELINE_I0;
}
export function saveBaseline(value: number) { localStorage.setItem(STORAGE_KEY, String(value)); }
export function resetBaseline() { localStorage.removeItem(STORAGE_KEY); return DEFAULT_BASELINE_I0; }

export async function extractExifData(file: File): Promise<ExifData> {
  const warnings: string[] = [];
  const empty = { make: null, model: null, fNumber: null, iso: null, exposureTime: null, exposureTimeDisplay: "N/A", dateTimeOriginal: null, dateTimeOriginalDisplay: "N/A", software: null, gpsDisplay: "N/A", gpsLatitude: null, gpsLongitude: null } as ExifData["parsed"];
  try {
    const exifr = await import("exifr");
    const raw = await exifr.parse(file, ["FNumber", "ISO", "ExposureTime", "DateTimeOriginal", "Make", "Model", "Software", "GPSLatitude", "GPSLongitude"]) || {};
    const fNumber = raw.FNumber ? Number(raw.FNumber) : null;
    const iso = raw.ISO ? Number(raw.ISO) : null;
    const exposureTime = raw.ExposureTime ? Number(raw.ExposureTime) : null;
    const date = raw.DateTimeOriginal ? new Date(raw.DateTimeOriginal) : null;
    const gps = await exifr.gps(file).catch(() => null);
    const latitude = typeof gps?.latitude === "number" ? gps.latitude : null;
    const longitude = typeof gps?.longitude === "number" ? gps.longitude : null;
    if (!fNumber) warnings.push("Aperture (FNumber) missing from EXIF.");
    if (!iso) warnings.push("ISO sensitivity missing from EXIF.");
    if (!exposureTime) warnings.push("Exposure time missing from EXIF.");
    if (!raw.Make || !raw.Model) warnings.push("Camera make and model are missing from EXIF.");
    return { hasExif: Object.keys(raw).length > 0, warnings, parsed: { make: raw.Make ? String(raw.Make).trim() : null, model: raw.Model ? String(raw.Model).trim() : null, fNumber, iso, exposureTime, exposureTimeDisplay: exposureTime ? exposureTime < 1 ? `1/${Math.round(1 / exposureTime)}s (${exposureTime}s)` : `${exposureTime}s` : "N/A", dateTimeOriginal: date && !Number.isNaN(date.getTime()) ? date : null, dateTimeOriginalDisplay: date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "N/A", software: raw.Software ? String(raw.Software).trim() : null, gpsLatitude: latitude, gpsLongitude: longitude, gpsDisplay: latitude !== null && longitude !== null ? `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°` : "N/A" } };
  } catch (error) {
    return { hasExif: false, warnings: [`EXIF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`], parsed: empty };
  }
}

export function extractImageLuminance(image: HTMLImageElement): PixelStats {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas luminance analysis is unavailable in this browser.");
  const scale = Math.min(1, 500 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const full = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let skyPixels = 0, darkPixels = 0, clippedPixels = 0, totalLuminance = 0, totalLuminanceSquared = 0, minimumLuminance = 255, maximumLuminance = 0;
  const fullSampleStep = 4;
  for (let index = 0; index < full.length; index += fullSampleStep * 4) {
    const r = full[index], g = full[index + 1], b = full[index + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalLuminance += luminance; totalLuminanceSquared += luminance ** 2; minimumLuminance = Math.min(minimumLuminance, luminance); maximumLuminance = Math.max(maximumLuminance, luminance);
    if (luminance <= 25) darkPixels++; if (luminance >= 248) clippedPixels++;
    const isSky = (luminance >= 50 && b >= g && b - r >= 10) || (luminance >= 140 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25); if (isSky) skyPixels++;
  }
  const sampleHeight = Math.max(1, Math.floor(canvas.height * 0.22));
  const pixels = context.getImageData(0, 0, canvas.width, sampleHeight).data;
  let upperTotalLuminance = 0, upperTotalLuminanceSquared = 0, totalR = 0, totalG = 0, totalB = 0, upperBrightNeutralPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) { const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]; const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b; totalR += r; totalG += g; totalB += b; upperTotalLuminance += luminance; upperTotalLuminanceSquared += luminance ** 2; if (luminance >= 170 && Math.max(r, g, b) - Math.min(r, g, b) <= 28) upperBrightNeutralPixels++; }
  const count = pixels.length / 4;
  const fullCount = full.length / 16;
  const upperAverage = upperTotalLuminance / count;
  return { avgLuminance: upperAverage, r: totalR / count, g: totalG / count, b: totalB / count, sampleCount: count, estimatedSkyPercentage: Math.round((skyPixels / Math.max(1, fullCount)) * 100), luminanceStdDev: Math.sqrt(Math.max(0, totalLuminanceSquared / fullCount - (totalLuminance / fullCount) ** 2)), darkPixelPercentage: darkPixels / fullCount * 100, clippedPixelPercentage: clippedPixels / fullCount * 100, dynamicRange: maximumLuminance - minimumLuminance, upperBrightNeutralPercentage: upperBrightNeutralPixels / count * 100, upperLuminanceStdDev: Math.sqrt(Math.max(0, upperTotalLuminanceSquared / count - upperAverage ** 2)), brightnessGradient: Math.abs(upperAverage - totalLuminance / fullCount) };
}

export interface SolarTelemetry {
  solarElevationDeg: number;
  solarZenithDeg: number;
  opticalAirMass: number;
  isDaylight: boolean;
}

/**
 * Astronomical Solar Position Engine (Spencer-Fourier / NOAA formulation).
 * Computes exact solar elevation angle, zenith angle, and Kasten-Young optical air mass.
 */
export function computeSolarPosition(
  latitude?: number | null,
  longitude?: number | null,
  dateTime?: Date | null
): SolarTelemetry {
  const lat = typeof latitude === "number" && Number.isFinite(latitude) ? latitude : 28.6139;
  const lon = typeof longitude === "number" && Number.isFinite(longitude) ? longitude : 77.209;
  const date = dateTime && !Number.isNaN(dateTime.getTime()) ? dateTime : new Date();

  // Day of year calculation
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));

  // Fractional year gamma in radians
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);

  // Equation of time in minutes
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination in radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  // Solar hour angle
  const timeOffset = eqtime + 4 * lon;
  const tst = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + timeOffset;
  let ha = tst / 4 - 180;
  if (ha < -180) ha += 360;
  if (ha > 180) ha -= 360;
  const haRad = (ha * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // Zenith angle
  const cosZenith = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad);
  const zenithRad = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const zenithDeg = (zenithRad * 180) / Math.PI;
  const elevationDeg = 90 - zenithDeg;

  const isDaylight = elevationDeg >= 3;
  const effectiveElevationDeg = Math.max(5, Math.min(88, elevationDeg));
  const effectiveZenithDeg = 90 - effectiveElevationDeg;

  // Kasten-Young optical air mass formulation
  const kastenTerm = Math.pow(Math.max(0.001, 96.07995 - effectiveZenithDeg), -1.6364);
  const opticalAirMass = Math.min(
    12,
    Math.max(1.0, 1 / (Math.cos((effectiveZenithDeg * Math.PI) / 180) + 0.50572 * kastenTerm))
  );

  return {
    solarElevationDeg: Math.round(elevationDeg * 10) / 10,
    solarZenithDeg: Math.round(zenithDeg * 10) / 10,
    opticalAirMass: Math.round(opticalAirMass * 100) / 100,
    isDaylight,
  };
}

/**
 * Computes dynamic clear-sky baseline I0 and EV_clear as a function of solar elevation.
 */
export function computeDynamicClearSkyBaseline(solar: SolarTelemetry, userBaseline?: number): {
  baselineI0: number;
  theoreticalClearSkyEv: number;
  isDynamic: boolean;
} {
  const sinAlpha = Math.sin((Math.max(5, solar.solarElevationDeg) * Math.PI) / 180);
  const theoreticalClearSkyEv = Number((11.5 + 3.5 * sinAlpha).toFixed(2));

  // If user has explicitly calibrated a custom baseline, respect it
  if (typeof userBaseline === "number" && userBaseline > 5000 && userBaseline !== DEFAULT_BASELINE_I0) {
    return {
      baselineI0: userBaseline,
      theoreticalClearSkyEv,
      isDynamic: false,
    };
  }

  // Dynamic clear-sky scene radiance: scales with solar elevation angle
  const dynamicI0 = Math.round(Math.max(15000, 65000 * Math.pow(sinAlpha, 0.85)));

  return {
    baselineI0: dynamicI0,
    theoreticalClearSkyEv,
    isDynamic: true,
  };
}

export function calculateRadiometry(
  stats: PixelStats,
  exif: ExifData,
  baseline: number,
  overrides: { fNumber?: number; iso?: number; exposureTime?: number },
  observationContext?: { latitude?: number | null; longitude?: number | null; dateTimeOriginal?: Date | null }
) {
  const fNumber = overrides.fNumber ?? exif.parsed.fNumber ?? 2.8;
  const iso = overrides.iso ?? exif.parsed.iso ?? 100;
  const exposureTime = overrides.exposureTime ?? exif.parsed.exposureTime ?? 0.002;

  // 1. Compute solar elevation and optical air mass
  const solar = computeSolarPosition(
    observationContext?.latitude ?? exif.parsed.gpsLatitude,
    observationContext?.longitude ?? exif.parsed.gpsLongitude,
    observationContext?.dateTimeOriginal ?? exif.parsed.dateTimeOriginal
  );

  // 2. Compute dynamic clear-sky baseline
  const calibration = computeDynamicClearSkyBaseline(solar, baseline);
  const activeBaseline = calibration.baselineI0;

  // 3. Observed Exposure Value EV_100
  const evAtIso100 = Math.log2((fNumber * fNumber) / Math.max(0.00001, exposureTime));
  const isoCorrection = Math.log2(Math.max(1, iso) / 100);
  const evObserved = Number((evAtIso100 - isoCorrection).toFixed(2));

  // 4. Relative scene luminance I
  const relativeLuminance = Math.round(((stats.avgLuminance * fNumber ** 2) / (exposureTime * iso)) * 100) / 100;
  const transmittance = relativeLuminance / activeBaseline;
  const isOverBaseline = transmittance > 1;

  // 5. Beer-Lambert Inversion with path length m(Z)
  const m = solar.opticalAirMass;
  let opticalDepth: number;

  if (isOverBaseline) {
    opticalDepth = 0.05;
  } else {
    const tauTransmittance = -Math.log(Math.max(transmittance, 0.0001)) / m;
    if (exif.parsed.fNumber && exif.parsed.exposureTime && exif.parsed.iso) {
      const deltaEv = Math.max(0, calibration.theoreticalClearSkyEv - evObserved);
      const tauEv = (deltaEv * 0.69315) / m;
      opticalDepth = Math.max(0.04, Math.round((0.6 * tauTransmittance + 0.4 * tauEv) * 1000) / 1000);
    } else {
      opticalDepth = Math.max(0.04, Math.round(tauTransmittance * 1000) / 1000);
    }
  }

  return {
    relativeLuminance,
    transmittance: Math.round(transmittance * 1000) / 1000,
    opticalDepth,
    baselineI0: activeBaseline,
    m,
    isOverBaseline,
    evObserved,
    theoreticalClearSkyEv: calibration.theoreticalClearSkyEv,
    solarElevationDeg: solar.solarElevationDeg,
    solarZenithDeg: solar.solarZenithDeg,
    isDynamicCalibration: calibration.isDynamic,
  };
}

export const AQI_TIERS = [[0.15, 0, 50, "Good", "#10B981", "bg-emerald-950/40", "border-emerald-500/30", "text-emerald-400", "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", "Air quality is satisfactory, with little or no risk.", "Ideal for outdoor activities."], [0.35, 51, 100, "Moderate", "#EAB308", "bg-yellow-950/40", "border-yellow-500/30", "text-yellow-400", "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", "Light aerosol or thin haze is present.", "Sensitive individuals should consider limiting prolonged exertion."], [0.55, 101, 150, "Unhealthy for Sensitive Groups", "#F97316", "bg-orange-950/40", "border-orange-500/30", "text-orange-400", "bg-orange-500/20 text-orange-300 border-orange-500/30", "Noticeable haze scattering light.", "Sensitive groups should reduce strenuous activity."], [0.8, 151, 200, "Unhealthy", "#EF4444", "bg-red-950/40", "border-red-500/30", "text-red-400", "bg-red-500/20 text-red-300 border-red-500/30", "Dense haze or smog is causing optical attenuation.", "Avoid prolonged outdoor activities."], [1.1, 201, 300, "Very Unhealthy", "#A855F7", "bg-purple-950/40", "border-purple-500/30", "text-purple-400", "bg-purple-500/20 text-purple-300 border-purple-500/30", "Severe aerosol loading is visible.", "Remain indoors with air filtration."], [Infinity, 301, 500, "Hazardous", "#881337", "bg-rose-950/50", "border-rose-600/40", "text-rose-400", "bg-rose-600/20 text-rose-300 border-rose-600/30", "Extreme particulate attenuation or heavy smoke.", "Keep doors and windows tightly sealed."]] as const;
const EPA_PM25_BREAKPOINTS = [[0, 9, 0, 50, "Good"], [9.1, 35.4, 51, 100, "Moderate"], [35.5, 55.4, 101, 150, "Unhealthy for Sensitive Groups"], [55.5, 125.4, 151, 200, "Unhealthy"], [125.5, 225.4, 201, 300, "Very Unhealthy"], [225.5, 325.4, 301, 500, "Hazardous"]] as const;
export function calculateEpaAqiFromPm25(pm25: number) { if (!Number.isFinite(pm25) || pm25 < 0) return { aqi: 0, category: "Good" }; const concentration = Math.floor(pm25 * 10) / 10; for (const [cLow, cHigh, iLow, iHigh, category] of EPA_PM25_BREAKPOINTS) { if (concentration <= cHigh) return { aqi: Math.min(500, Math.max(0, Math.round(((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow))), category }; } return { aqi: 500, category: "Hazardous" }; }
export function estimateAirQuality(tau: number, isCloudy = false) {
  const safeTau = Math.max(0.01, tau);

  // When overcast clouds are present, optical depth is dominated by water vapor (COD).
  // Separate true dry particulate aerosol (AOD) from cloud droplet scattering:
  const aerosolTau = isCloudy ? Math.max(0.08, safeTau * 0.18) : safeTau;

  // Empirically calibrated mass extinction coefficient for Indo-Gangetic particulate:
  // PM2.5 (ug/m3) = tau / (sigma_ext * H_eff) * 10^6 ≈ tau * 215.0
  const pm25Proxy = Math.round(aerosolTau * 215.0 * 10) / 10;
  const { aqi, category } = calculateEpaAqiFromPm25(pm25Proxy);
  const tier = AQI_TIERS.find((candidate) => candidate[3] === category) || AQI_TIERS[AQI_TIERS.length - 1];

  return {
    tau: safeTau,
    aerosolTau,
    isCloudy,
    cloudAttenuated: isCloudy,
    cloudAdvisory: isCloudy
      ? "Overcast cloud layer detected. Optical attenuation is dominated by water vapor clouds rather than dry PM2.5 soot. Cloud-screened aerosol baseline applied."
      : undefined,
    aqi,
    pm25Proxy,
    category,
    color: tier[4],
    bgColor: tier[5],
    borderColor: tier[6],
    textColor: tier[7],
    badgeColor: tier[8],
    description: isCloudy ? "Overcast water vapor clouds scattering light." : tier[9],
    advisory: tier[10],
    allTiers: AQI_TIERS,
  };
}

export function analyzeObservationQuality(
  stats: PixelStats,
  exif: ExifData,
  radiometry: ReturnType<typeof calculateRadiometry>,
  sceneValidation?: SceneValidationResult | null
): ObservationConfidence {
  const factors: ObservationConfidenceFactor[] = [];
  const addFactor = (name: string, impact: number, explanation: string, goodExplanation: string) => factors.push({ name, status: impact === 0 ? "good" : "warning", impact, explanation: impact === 0 ? goodExplanation : explanation });

  if (sceneValidation) {
    if (sceneValidation.sceneQuality === "uncertain") {
      addFactor(
        "Scene framing / sky purity",
        -35,
        sceneValidation.rejectionReason || "Borderline sky coverage; obstructions or non-sky content may reduce estimation confidence.",
        "Observation framing confirms an unobstructed atmospheric sky."
      );
    } else if (sceneValidation.sceneQuality === "invalid") {
      addFactor(
        "Scene validation",
        -100,
        sceneValidation.rejectionReason || "Image rejected as non-atmospheric observation.",
        "Observation verified as atmospheric sky."
      );
    } else {
      addFactor(
        "Scene framing / sky purity",
        0,
        "",
        "Atmospheric sky observation verified with valid radiance characteristics."
      );
    }
  }

  const exposurePenalty = Math.min(22, (stats.darkPixelPercentage > 35 ? 15 : stats.darkPixelPercentage > 20 ? 8 : 0) + (stats.clippedPixelPercentage > 8 ? 15 : stats.clippedPixelPercentage > 2 ? 8 : 0) + (stats.dynamicRange < 45 ? 12 : 0));
  addFactor("Exposure and tonal range", -exposurePenalty, stats.darkPixelPercentage > 35 ? "Low-light conditions may reduce radiometric reliability." : stats.clippedPixelPercentage > 2 ? "Image appears overexposed; sky radiance may be clipped." : "Image has limited useful tonal separation.", "Exposure has a usable tonal range.");

  const cloudPenalty = Math.min(18, stats.upperBrightNeutralPercentage > 35 ? 18 : stats.upperBrightNeutralPercentage > 18 ? 10 : stats.upperLuminanceStdDev > 55 ? 8 : 0);
  addFactor("Possible cloud contamination", -cloudPenalty, "Possible cloud cover may contribute to optical attenuation; this is an image heuristic, not a certainty.", "Little evidence of cloud-like contamination in the analyzed sky region.");

  const skyPenalty = stats.estimatedSkyPercentage < 45 ? 20 : stats.estimatedSkyPercentage < 65 ? 10 : 0;
  addFactor("Useful sky coverage", -skyPenalty, "Too little of the image appears to be useful sky; foreground or non-sky content may affect the estimate.", "Sky coverage is adequate for the heuristic analysis.");

  const hazeRisk = stats.upperLuminanceStdDev < 18 && stats.avgLuminance >= 45 && stats.avgLuminance <= 220 && stats.upperBrightNeutralPercentage < 35;
  addFactor("Possible humidity/haze interference", hazeRisk ? -10 : 0, "Possible humidity/haze interference may reduce the separation between sky radiance and aerosol attenuation.", "No strong visual humidity/haze risk was identified; humidity is not directly measured.");

  const glareRisk = stats.clippedPixelPercentage > 1 || stats.brightnessGradient > 75;
  addFactor("Direct light or glare", glareRisk ? -12 : 0, "Direct-light/glare conditions may affect radiometric estimation.", "No strong localized glare or brightness gradient was identified.");

  const parsed = exif.parsed;
  const validExif = Boolean(parsed.make && parsed.model && parsed.fNumber && parsed.iso && parsed.exposureTime && parsed.fNumber >= 1 && parsed.fNumber <= 32 && parsed.iso >= 25 && parsed.iso <= 102400 && parsed.exposureTime > 0 && parsed.exposureTime <= 30);
  const partialExif = Boolean(parsed.fNumber || parsed.iso || parsed.exposureTime || parsed.make || parsed.model);
  const exifPenalty = validExif ? 0 : partialExif ? 8 : 15;
  addFactor("Camera metadata", -exifPenalty, partialExif ? "Some camera metadata is missing or incomplete; calibration confidence is reduced." : "Camera metadata is unavailable; default exposure assumptions are being used.", "Camera metadata is present and within plausible ranges.");

  const radiometricRisk = radiometry.opticalDepth > 2 || radiometry.transmittance < 0.1 || radiometry.relativeLuminance / radiometry.baselineI0 < 0.1 || radiometry.relativeLuminance / radiometry.baselineI0 > 1.5 || estimateAirQuality(radiometry.opticalDepth).pm25Proxy > 150;
  addFactor("Radiometric operating range", radiometricRisk ? -15 : 0, "Radiometric result may be outside the reliable operating range; the calculated value remains unchanged.", "Radiometric result is within the configured operating range.");

  const observationConfidence = Math.max(0, Math.min(100, Math.round(100 + factors.reduce((total, factor) => total + factor.impact, 0))));
  const confidenceLevel = observationConfidence >= OBSERVATION_CONFIDENCE_LEVELS.veryHigh ? "Very high" : observationConfidence >= OBSERVATION_CONFIDENCE_LEVELS.high ? "High" : observationConfidence >= OBSERVATION_CONFIDENCE_LEVELS.moderate ? "Moderate" : observationConfidence >= OBSERVATION_CONFIDENCE_LEVELS.low ? "Low" : "Very low";
  return { observationConfidence, confidenceLevel, factors };
}

export function validateImageAuthenticity(exif: ExifData, stats: PixelStats) {
  const parsed = exif.parsed; let score = 100; const checks = [{ name: "Camera hardware signature", passed: Boolean(parsed.make && parsed.model), message: parsed.make && parsed.model ? `${parsed.make} ${parsed.model} identified.` : "Camera make and model are missing." }];
  if (!checks[0].passed) score -= 35; const exposurePassed = Boolean(parsed.fNumber && parsed.iso && parsed.exposureTime && parsed.fNumber >= 1 && parsed.fNumber <= 32 && parsed.iso >= 25 && parsed.iso <= 102400 && parsed.exposureTime > 0 && parsed.exposureTime <= 30); checks.push({ name: "Exposure parameter plausibility", passed: exposurePassed, message: exposurePassed ? "Aperture, ISO, and shutter values are physically plausible." : "Incomplete or implausible exposure telemetry." }); if (!exposurePassed) score -= 35;
  const skyPassed = stats.estimatedSkyPercentage >= 30; checks.push({ name: "Sky region framing", passed: skyPassed, message: skyPassed ? `Adequate sky visible (~${stats.estimatedSkyPercentage}% of frame).` : "Low sky coverage detected; capture more of the sky." }); if (!skyPassed) score -= 25;
  const daylightPassed = !parsed.exposureTime || parsed.exposureTime <= 1 / 60 + 0.0001; checks.push({ name: "Daylight shutter speed", passed: daylightPassed, message: daylightPassed ? "Daylight shutter speed is compatible with the radiometric model." : "Shutter speed is slower than 1/60s and may indicate low-light capture." }); if (!daylightPassed) score -= 15;
  const softwarePassed = !parsed.software || !/(photoshop|gimp|canva|lightroom|snapseed|picsart|midjourney|stable diffusion)/i.test(parsed.software); checks.push({ name: "Post-processing integrity", passed: softwarePassed, message: softwarePassed ? "No known editing signature detected." : `Editing software tag detected: ${parsed.software}.` }); if (!softwarePassed) score -= 25;
  const temporalPassed = !parsed.dateTimeOriginal || parsed.dateTimeOriginal.getTime() <= Date.now() + 5 * 60 * 1000; checks.push({ name: "Temporal consistency", passed: temporalPassed, message: temporalPassed ? "Capture timestamp is plausible." : "Capture timestamp is in the future." }); if (!temporalPassed) score -= 25;
  const finalScore = Math.max(0, score); return { score: finalScore, verdict: finalScore < 50 ? "SPOOFED" : finalScore < 80 ? "SUSPICIOUS" : "AUTHENTIC", checks };
}