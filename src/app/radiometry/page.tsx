"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  calculateRadiometry,
  analyzeObservationQuality,
  estimateAirQuality,
  extractExifData,
  extractImageLuminance,
  ExifData,
  getBaseline,
  PixelStats,
  resetBaseline,
  saveBaseline,
  validateImageAuthenticity,
  validateImageScene,
  formatDetectedType,
  SceneValidationResult,
} from "./radiometryLogic";
import {
  analyzeSkyHazeWithGemini,
  compareRadiometryWithGroundTruth,
  fetchAirQualityForObservation,
  formatMinutesAgo,
  getPresetGroundTruth,
  GroundTruthResult,
  isValidCoordinate,
  KNOWN_CITIES,
  ObservationLocation,
  PRESET_SCENARIOS,
  PresetScenario,
  resolveObservationLocation,
  reverseGeocodeCoordinates,
  unavailableGroundTruth,
  VisionResult,
} from "./radiometryServices";
import { getGeeOrbitalAnchorForCoordinate } from "@/lib/earthEngine";

type Overrides = { fNumber?: number; iso?: number; exposureTime?: number };
type ImageState = { url: string; name: string; size: number; isDemo?: boolean };

const demoExif: ExifData = {
  hasExif: true, warnings: [],
  parsed: {
    make: "Sony", model: "ILCE-7M4", fNumber: 5.6, iso: 100, exposureTime: 0.001,
    exposureTimeDisplay: "1/1000s (0.001s)", dateTimeOriginal: new Date(),
    dateTimeOriginalDisplay: new Date().toLocaleString(), software: "ILCE-7M4 firmware",
    gpsDisplay: "28.6139°, 77.2090°", gpsLatitude: 28.6139, gpsLongitude: 77.209,
  },
};

const demoUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><linearGradient id="sky" y2="1"><stop stop-color="#2274c6"/><stop offset="1" stop-color="#a9d5ed"/></linearGradient></defs><rect width="900" height="600" fill="url(#sky)"/><path d="M0 510 Q150 470 300 505 T600 495 T900 505 V600 H0Z" fill="#879aa1" opacity=".2"/></svg>`)}`;

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`radiometry-panel ${className}`}>{children}</section>; }
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="radiometry-stat"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }

export default function RadiometryPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [baseline, setBaseline] = useState(getBaseline);
  const [image, setImage] = useState<ImageState>({ url: demoUrl, name: "clear-sky-demo.svg", size: 4.8 * 1024 * 1024, isDemo: true });
  const [exif, setExif] = useState<ExifData>(demoExif);
  const [stats, setStats] = useState<PixelStats>({ avgLuminance: 164, r: 130, g: 165, b: 190, sampleCount: 60000, estimatedSkyPercentage: 89, luminanceStdDev: 45, darkPixelPercentage: 2, clippedPixelPercentage: 0, dynamicRange: 180, upperBrightNeutralPercentage: 4, upperLuminanceStdDev: 35, brightnessGradient: 20 });
  const [overrides, setOverrides] = useState<Overrides>({});
  const [locationOverride, setLocationOverride] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationValue, setCalibrationValue] = useState(() => String(getBaseline()));
  const [showManual, setShowManual] = useState(false);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [groundTruth, setGroundTruth] = useState<GroundTruthResult>(() => getPresetGroundTruth(28.6139, 77.209));
  const [groundTruthLoading, setGroundTruthLoading] = useState(false);
  const [observationLocation, setObservationLocation] = useState<ObservationLocation | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "detecting" | "granted" | "denied" | "error" | "unsupported">("idle");
  const [sceneValidation, setSceneValidation] = useState<SceneValidationResult>({
    sceneValid: true,
    sceneQuality: "valid",
    detectedType: "clear_sky",
    userMessage: {
      title: "Atmospheric observation verified",
      description: "Valid outdoor sky region detected suitable for radiometric analysis.",
      action: "Physics calculation active.",
    },
    metrics: {
      edgeDensity: 1.2,
      skyCoverage: 89,
      upperSkyCoverage: 95,
      skinPercentage: 0,
      upperSkinPercentage: 0,
      flatLineRatio: 0,
      avgLuminance: 164,
      darkPixelPercentage: 2,
      clippedPixelPercentage: 0,
    },
  });

  const activeLocation = resolveObservationLocation(exif, locationOverride, image.name);
  const effectiveCoordinates = observationLocation
    ? { lat: observationLocation.latitude, lon: observationLocation.longitude }
    : activeLocation;

  const isAtmosphericSky = sceneValidation.sceneValid;

  const radiometry = isAtmosphericSky
    ? calculateRadiometry(
        stats,
        exif,
        baseline,
        overrides,
        {
          latitude: effectiveCoordinates?.lat,
          longitude: effectiveCoordinates?.lon,
          dateTimeOriginal: exif.parsed.dateTimeOriginal,
        }
      )
    : null;

  const isCloudy =
    sceneValidation?.detectedType === "cloudy_sky" ||
    Boolean(stats && stats.upperBrightNeutralPercentage > 20) ||
    Boolean(stats && stats.avgLuminance > 110 && Math.abs(stats.r - stats.b) < 22 && (radiometry?.opticalDepth ?? 0) > 0.45);

  const air = isAtmosphericSky && radiometry
    ? estimateAirQuality(radiometry.opticalDepth, isCloudy)
    : null;

  const observation = isAtmosphericSky && radiometry
    ? analyzeObservationQuality(stats, exif, radiometry, sceneValidation)
    : null;

  const validation = validateImageAuthenticity(exif, stats);

  const referenceComparison = isAtmosphericSky && air
    ? compareRadiometryWithGroundTruth(air.aqi, groundTruth)
    : {
        available: false,
        label: "Reference comparison unavailable",
        deltaAqi: null,
        absoluteError: null,
        percentageError: null,
        verdict: "Reference comparison unavailable",
        isDivergent: false,
        divergenceExplanation: undefined,
      };

  function requestBrowserLocation(obsTimestamp?: string) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("unsupported");
      setGroundTruth(
        unavailableGroundTruth("unsupported", "Geolocation is not supported by this browser.", obsTimestamp)
      );
      return;
    }

    setLocationState("detecting");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const accuracy =
          typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
            ? Math.round(pos.coords.accuracy)
            : undefined;
        const timestamp = new Date(pos.timestamp || Date.now()).toISOString();

        if (!isValidCoordinate(lat, lon)) {
          setLocationState("error");
          setGroundTruth(
            unavailableGroundTruth("browser-gps", "Unable to determine valid geographic coordinates.", obsTimestamp)
          );
          return;
        }

        const localityName = await reverseGeocodeCoordinates(lat, lon);
        const loc: ObservationLocation = {
          latitude: lat,
          longitude: lon,
          accuracy,
          timestamp,
          source: "browser-gps",
          localityName,
        };

        setObservationLocation(loc);
        setLocationState("granted");

        // Query nearby reference station with true coordinates
        setGroundTruthLoading(true);
        void fetchAirQualityForObservation(loc, obsTimestamp)
          .then((nextGroundTruth) => setGroundTruth(nextGroundTruth))
          .catch(() => {
            setGroundTruth(
              unavailableGroundTruth("browser-gps", "No geographically representative OpenAQ station was found for this observation.", obsTimestamp)
            );
          })
          .finally(() => setGroundTruthLoading(false));
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationState("denied");
          setObservationLocation(null);
          setGroundTruth(
            unavailableGroundTruth("browser_denied", "Location permission was denied. Local station corroboration is unavailable.", obsTimestamp)
          );
        } else {
          setLocationState("error");
          setObservationLocation(null);
          setGroundTruth(
            unavailableGroundTruth("browser_error", "Unable to determine location. Please enable location access and try again.", obsTimestamp)
          );
        }
        setGroundTruthLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    setLoading(true); setError(""); setOverrides({});
    const url = URL.createObjectURL(file);

    // 1. Immediately show photo preview without blocking on GPS
    setImage({ url, name: file.name, size: file.size, isDemo: false });

    try {
      const nextExif = await extractExifData(file);
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("The image preview could not be read."));
      });

      setExif(nextExif);

      const obsTimestamp = nextExif.parsed.dateTimeOriginal && !Number.isNaN(nextExif.parsed.dateTimeOriginal.getTime())
        ? nextExif.parsed.dateTimeOriginal.toISOString()
        : undefined;

      // 2. MANDATORY PIPELINE:
      // Uploaded image -> IMAGE TYPE / SCENE VALIDATION
      const validationResult = validateImageScene(img, nextExif, file.name);
      setSceneValidation(validationResult);

      if (!validationResult.sceneValid) {
        // REJECT: Do NOT calculate AQI, PM2.5, tau, OpenAQ comparison, or attribution
        setGroundTruth(unavailableGroundTruth("rejected", "No geographically representative OpenAQ station was found for this observation."));
        setVision(null);
        setGroundTruthLoading(false);
        setVisionLoading(false);
        setLocationState("idle");
        return;
      }

      // 3. Automatically request browser geolocation for live observation
      requestBrowserLocation(obsTimestamp);

      const nextStats = extractImageLuminance(img);
      setStats(nextStats);

      const obsLocation = resolveObservationLocation(nextExif, locationOverride, file.name);

      setVisionLoading(true);
      const nextRadiometry = calculateRadiometry(
        nextStats,
        nextExif,
        baseline,
        {},
        {
          latitude: observationLocation?.latitude ?? obsLocation?.lat,
          longitude: observationLocation?.longitude ?? obsLocation?.lon,
          dateTimeOriginal: nextExif.parsed.dateTimeOriginal,
        }
      );
      const nextIsCloudy =
        validationResult.detectedType === "cloudy_sky" ||
        nextStats.upperBrightNeutralPercentage > 20 ||
        (nextStats.avgLuminance > 110 && Math.abs(nextStats.r - nextStats.b) < 22 && nextRadiometry.opticalDepth > 0.45);
      const nextAir = estimateAirQuality(nextRadiometry.opticalDepth, nextIsCloudy);

      void analyzeSkyHazeWithGemini(
        file,
        { opticalDepth: nextRadiometry.opticalDepth, aqi: nextAir.aqi },
        observationLocation?.localityName || "India"
      )
        .then((nextVision) => setVision(nextVision))
        .catch(() => setVision(null))
        .finally(() => setVisionLoading(false));
    } catch (reason) {
      URL.revokeObjectURL(url);
      setError(reason instanceof Error ? reason.message : "Unable to analyze this image.");
    } finally {
      setLoading(false);
    }
  }

  function selectPreset(preset: PresetScenario) {
    setError(""); setOverrides({}); setLocationOverride(null);
    setObservationLocation(null);
    setLocationState("idle");
    setImage({ url: preset.previewUrl, name: preset.fakeFile.name, size: preset.fakeFile.size, isDemo: true });
    setExif(preset.exif);
    setStats({ avgLuminance: preset.simulatedLuminance, r: preset.simulatedLuminance * .9, g: preset.simulatedLuminance * .95, b: preset.simulatedLuminance, sampleCount: 100000, estimatedSkyPercentage: preset.estimatedSkyPercentage, luminanceStdDev: preset.id === "urban-smog" ? 28 : 45, darkPixelPercentage: 1, clippedPixelPercentage: 0, dynamicRange: 180, upperBrightNeutralPercentage: preset.id === "urban-smog" ? 20 : 4, upperLuminanceStdDev: preset.id === "urban-smog" ? 14 : 35, brightnessGradient: 20 });
    setSceneValidation({
      sceneValid: true,
      sceneQuality: "valid",
      detectedType: preset.id === "urban-smog" ? "hazy_sky" : "clear_sky",
      userMessage: {
        title: "Atmospheric observation verified",
        description: "Valid outdoor sky region detected suitable for radiometric analysis.",
        action: "Physics calculation active.",
      },
      metrics: {
        edgeDensity: preset.id === "urban-smog" ? 2.1 : 1.2,
        skyCoverage: preset.estimatedSkyPercentage,
        upperSkyCoverage: 92,
        skinPercentage: 0,
        upperSkinPercentage: 0,
        flatLineRatio: 0,
        avgLuminance: preset.simulatedLuminance,
        darkPixelPercentage: 1,
        clippedPixelPercentage: 0,
      },
    });
    setGroundTruth(getPresetGroundTruth(preset.presetLocation.lat, preset.presetLocation.lon));
    setVision(null); setGroundTruthLoading(false); setVisionLoading(false);
  }

  function selectCityOverride(cityName: string) {
    const key = cityName.toLowerCase().trim();
    if (key in KNOWN_CITIES) {
      const city = KNOWN_CITIES[key];
      const override = { lat: city.lat, lon: city.lon, name: city.name };
      setLocationOverride(override);
      if (typeof window !== "undefined") {
        localStorage.setItem("tropos_selected_city", key);
      }
      if (!image.isDemo) {
        setGroundTruthLoading(true);
        const obsTimestamp = exif.parsed.dateTimeOriginal && !Number.isNaN(exif.parsed.dateTimeOriginal.getTime())
          ? exif.parsed.dateTimeOriginal.toISOString()
          : undefined;
        void fetchAirQualityForObservation(
          { lat: city.lat, lon: city.lon, source: "user_selected", label: city.name },
          obsTimestamp
        )
          .then((gt) => setGroundTruth(gt))
          .catch(() => setGroundTruth(unavailableGroundTruth("user_selected", "No geographically representative OpenAQ station was found for this observation.", obsTimestamp)))
          .finally(() => setGroundTruthLoading(false));
      }
    } else if (!cityName) {
      setLocationOverride(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("tropos_selected_city");
      }
    }
  }

  function detectBrowserLocation() {
    const obsTimestamp = exif.parsed.dateTimeOriginal && !Number.isNaN(exif.parsed.dateTimeOriginal.getTime())
      ? exif.parsed.dateTimeOriginal.toISOString()
      : undefined;
    requestBrowserLocation(obsTimestamp);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void processFile(file); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void processFile(file); }
  function changeOverride(key: keyof Overrides, value: string) { const parsed = Number(value); setOverrides((current) => ({ ...current, [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined })); }
  function saveCalibration() { const value = Number(calibrationValue); if (value > 0) { saveBaseline(value); setBaseline(value); setShowCalibration(false); } }

  return <div className="radiometry-page">
    <Navigation />
    <main>
      <section className="product-tile-parchment radiometry-intro"><div className="container-wide"><span className="radiometry-kicker">CITIZEN SENSING &bull; INNOVATION 03</span><h1 className="hero-display">Camera Radiometry.</h1><p className="lead">Turn an ordinary sky photograph into a calibrated atmospheric observation.</p><p className="radiometry-intro-note">All core measurements run in your browser. Your image stays on this device while Exur derives relative scene radiance, aerosol optical depth, and an AQI proxy.</p></div></section>
      <section className="radiometry-workspace"><div className="container-wide">
        <div className="radiometry-toolbar"><div><span className="eyebrow">FIELD INSTRUMENT</span><strong>Sky observation console</strong></div><button className="button-secondary-pill" onClick={() => setShowCalibration(true)}>Calibrate I<sub>0</sub> <span aria-hidden="true">&rarr;</span></button></div>
        <div className="radiometry-presets"><span className="eyebrow">DEMO OBSERVATIONS</span><div>{PRESET_SCENARIOS.map((preset) => <button key={preset.id} onClick={() => selectPreset(preset)}>{preset.title}</button>)}</div></div>
        {error && <div className="radiometry-alert" role="alert">{error}</div>}
        <div className="radiometry-grid">
          <div className="radiometry-column">
            <Panel className="upload-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">01 / CAPTURE</span>
                  <h2>Bring the sky into focus.</h2>
                </div>
                <span className="panel-mark">A</span>
              </div>
              <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onInput} hidden />
              <div className={`radiometry-dropzone ${loading ? "is-loading" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
                {loading ? <div className="radiometry-loader"><span />Reading image telemetry...</div> : <><img src={image.url} alt="Current sky observation" /><div className="dropzone-overlay"><span>Replace observation</span><small>Drop a photo or browse your device</small></div></>}
              </div>
              <div className="upload-meta">
                <div>
                  <strong>{image.name}</strong>
                  <span>{(image.size / (1024 * 1024)).toFixed(2)} MB {image.isDemo ? "· Demonstration observation" : "· Local analysis"}</span>
                </div>
                <button className="text-link" onClick={() => inputRef.current?.click()}>Choose another &rarr;</button>
              </div>

              {!image.isDemo && locationState !== "idle" && (
                <div className="observation-location-card">
                  {locationState === "detecting" && (
                    <div className="location-card-detecting">
                      <div className="location-spinner" />
                      <div>
                        <span className="location-card-eyebrow">
                          <span className="location-pin">📍</span> Detecting observation location...
                        </span>
                        <p className="location-card-subtext">
                          Allow location access to validate the observation against nearby monitoring stations.
                        </p>
                      </div>
                    </div>
                  )}
                  {locationState === "granted" && observationLocation && (
                    <>
                      <div className="location-card-header">
                        <span className="location-card-eyebrow">
                          <span className="location-pin">📍</span> Location detected
                        </span>
                        <span className="location-badge-gps">
                          GPS detected{observationLocation.accuracy ? ` · Accuracy ${observationLocation.accuracy} m` : ""}
                        </span>
                      </div>
                      <h4 className="location-card-title">
                        {observationLocation.localityName || `${observationLocation.latitude.toFixed(4)}°, ${observationLocation.longitude.toFixed(4)}°`}
                      </h4>
                      <p className="location-card-subtext">
                        {observationLocation.latitude.toFixed(4)}°N, {observationLocation.longitude.toFixed(4)}°E · Observation timestamp {new Date(observationLocation.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </>
                  )}
                  {locationState === "denied" && (
                    <div>
                      <div className="location-card-header">
                        <span className="location-card-eyebrow">
                          <span className="location-pin">📍</span> Location unavailable
                        </span>
                      </div>
                      <h4 className="location-card-title">Permission denied</h4>
                      <p className="location-card-subtext">
                        Location permission was denied. Local station corroboration is unavailable.
                      </p>
                    </div>
                  )}
                  {locationState === "error" && (
                    <div>
                      <div className="location-card-header">
                        <span className="location-card-eyebrow">
                          <span className="location-pin">📍</span> Unable to determine location
                        </span>
                        <button
                          type="button"
                          className="location-retry-btn"
                          onClick={() => {
                            const obsTimestamp = exif.parsed.dateTimeOriginal && !Number.isNaN(exif.parsed.dateTimeOriginal.getTime())
                              ? exif.parsed.dateTimeOriginal.toISOString()
                              : undefined;
                            requestBrowserLocation(obsTimestamp);
                          }}
                        >
                          Retry GPS
                        </button>
                      </div>
                      <p className="location-card-subtext">
                        Please enable location access and try again.
                      </p>
                    </div>
                  )}
                  {locationState === "unsupported" && (
                    <div>
                      <div className="location-card-header">
                        <span className="location-card-eyebrow">
                          <span className="location-pin">📍</span> Location unavailable
                        </span>
                      </div>
                      <p className="location-card-subtext">
                        Geolocation is not supported by this browser.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="capture-tip">For a clean reading, point 45°–80° toward the zenith and away from direct sun.</p>
            </Panel>
            <Panel>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">02 / TELEMETRY</span>
                  <h2>Camera signature.</h2>
                </div>
                <button className="quiet-button" onClick={() => setShowManual(!showManual)}>{showManual ? "Close editor" : "Edit values"}</button>
              </div>
              <div className="telemetry-device">
                <span>Device / camera model</span>
                <strong>{exif.parsed.make || "Unknown make"} <i /> {exif.parsed.model || "Unknown model"}</strong>
              </div>
              <div className="telemetry-grid">
                <Stat label="Aperture" value={exif.parsed.fNumber ? `f/${exif.parsed.fNumber}` : "Missing"} />
                <Stat label="ISO sensitivity" value={exif.parsed.iso ? `ISO ${exif.parsed.iso}` : "Missing"} />
                <Stat label="Shutter speed" value={exif.parsed.exposureTimeDisplay} />
              </div>
              <div className="telemetry-row">
                <span>Capture date</span>
                <strong suppressHydrationWarning>{exif.parsed.dateTimeOriginalDisplay}</strong>
              </div>
              <div className="telemetry-row">
                <span>Location signal</span>
                <strong>
                  {observationLocation
                    ? `${observationLocation.localityName || "Browser GPS"} (${observationLocation.latitude.toFixed(4)}°, ${observationLocation.longitude.toFixed(4)}°)`
                    : activeLocation
                    ? activeLocation.label
                    : "Location unavailable"}
                </strong>
              </div>
              {exif.parsed.gpsLatitude && observationLocation && (
                <div className="telemetry-row">
                  <span>Photo EXIF GPS</span>
                  <strong>{exif.parsed.gpsDisplay}</strong>
                </div>
              )}
              {showManual && (
                <div className="manual-editor">
                  <span className="eyebrow">MANUAL OVERRIDE</span>
                  <div className="manual-grid">
                    <label>F-number<input type="number" step=".1" min=".9" placeholder={String(exif.parsed.fNumber ?? 2.8)} onChange={(event) => changeOverride("fNumber", event.target.value)} /></label>
                    <label>ISO<input type="number" min="25" placeholder={String(exif.parsed.iso ?? 100)} onChange={(event) => changeOverride("iso", event.target.value)} /></label>
                    <label>Shutter (s)<input type="number" step=".0005" min=".00001" placeholder={String(exif.parsed.exposureTime ?? .002)} onChange={(event) => changeOverride("exposureTime", event.target.value)} /></label>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ display: "grid", gap: "6px", fontSize: "11px", color: "var(--color-ink-muted-48)" }}>
                      City / Observation Location
                      <div style={{ display: "flex", gap: "8px" }}>
                        <select
                          style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid var(--color-hairline)", background: "#fff", color: "var(--color-ink)", font: "inherit", fontSize: "12px" }}
                          value={locationOverride?.name ? Object.keys(KNOWN_CITIES).find(k => KNOWN_CITIES[k].name === locationOverride.name) || "" : ""}
                          onChange={(e) => selectCityOverride(e.target.value)}
                        >
                          <option value="">{observationLocation ? "Browser GPS location active" : exif.parsed.gpsLatitude ? "Photo GPS telemetry" : "Select location…"}</option>
                          <option value="indore">Vijay Nagar, Indore</option>
                          <option value="delhi">Delhi NCR</option>
                          <option value="gurugram">Gurugram</option>
                          <option value="noida">Noida</option>
                          <option value="mumbai">Mumbai</option>
                          <option value="bengaluru">Bengaluru</option>
                        </select>
                        <button type="button" className="quiet-button" style={{ fontSize: "11px", whiteSpace: "nowrap" }} onClick={detectBrowserLocation}>Use GPS</button>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              {exif.warnings.length > 0 && <p className="telemetry-warning">{exif.warnings[0]}</p>}
            </Panel>
          </div>
          <div className="radiometry-column">
            {!sceneValidation.sceneValid ? (
              <Panel className="aq-panel rejection-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow" style={{ color: "#dc2626" }}>03 / VALIDATION REJECTED</span>
                    <h2>Observation rejected.</h2>
                  </div>
                  <span className="badge-rejected">REJECTED</span>
                </div>
                <div className="rejection-hero">
                  <div className="rejection-icon" aria-hidden="true">✕</div>
                  <div className="rejection-content">
                    <h3>This image does not appear to be a valid atmospheric sky observation.</h3>
                    <p className="rejection-advisory">Capture/upload an unobstructed outdoor sky image for radiometric analysis.</p>
                    <div className="rejection-details">
                      <div className="rejection-tag">
                        <span>Detected scene</span>
                        <strong>{formatDetectedType(sceneValidation.detectedType)}</strong>
                      </div>
                      {sceneValidation.rejectionReason && (
                        <p className="rejection-reason">{sceneValidation.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rejection-gating-notice">
                  <strong>Radiometric calculations suspended</strong>
                  <span>AQI estimation, PM2.5 proxy, optical depth τ, and independent corroboration are withheld because the uploaded image does not contain measurable atmospheric sky radiance.</span>
                </div>
              </Panel>
            ) : air ? (
              <Panel className="aq-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">03 / ATMOSPHERE</span>
                    <h2>Camera-derived estimate.</h2>
                  </div>
                  <span className="quality-badge">{air.category}</span>
                </div>
                {sceneValidation.sceneQuality === "uncertain" && (
                  <div className="uncertainty-banner">
                    <span aria-hidden="true">⚠</span>
                    <div>
                      <strong>Uncertain observation framing: </strong>
                      {sceneValidation.rejectionReason || "Borderline sky coverage; obstructions or non-sky content may reduce estimation confidence."}
                    </div>
                  </div>
                )}
                {air.cloudAttenuated && (
                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0, 102, 204, 0.06)",
                    border: "1px solid rgba(0, 102, 204, 0.2)",
                    marginBottom: "14px",
                    fontSize: "12px",
                    color: "#0066cc",
                    lineHeight: 1.4,
                  }}>
                    <span style={{ fontSize: "16px" }}>☁️</span>
                    <div>
                      <strong>Overcast Cloud Screening Active: </strong>
                      Optical attenuation is dominated by water vapor clouds rather than dry PM2.5 soot. Atmospheric cloud-screening applied.
                    </div>
                  </div>
                )}
                <div className="aq-hero">
                  <div>
                    <span>Indicative AQI</span>
                    <strong>{air.aqi}</strong>
                    <small style={{ display: "block", fontSize: "11px", color: "var(--color-ink-muted-48)", marginTop: "2px" }}>
                      Indicative proxy · Not reference-grade
                    </small>
                  </div>
                  <div>
                    <span>PM2.5 mass proxy</span>
                    <strong>{air.pm25Proxy} <small>µg/m³</small></strong>
                    <em>AOD τ {air.tau.toFixed(3)}</em>
                  </div>
                </div>
                <div className="aq-scale"><i /><i /><i /><i /><i /><i /></div>
                <p>{air.description}</p>
                <div className="aq-advisory">
                  <strong>Health recommendation</strong>
                  {air.advisory}
                </div>
              </Panel>
            ) : null}

            {!sceneValidation.sceneValid ? (
              <Panel>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">04 / PHYSICS</span>
                    <h2>Radiometry result.</h2>
                  </div>
                  <span className="formula-chip" style={{ background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>Suspended</span>
                </div>
                <div className="rejection-placeholder">
                  <p>Beer–Lambert physical inversion τ = −(1/m) · ln(I / I₀) is suspended.</p>
                  <small>Physical radiometry requires unobstructed atmospheric solar scattering.</small>
                </div>
              </Panel>
            ) : radiometry ? (
              <Panel>
                <div className="panel-heading">
                  <div><span className="eyebrow">04 / PHYSICS</span><h2>Radiometry result.</h2></div>
                  <span className="formula-chip">Beer–Lambert</span>
                </div>
                <div className="metric-grid">
                  <Stat label="Aerosol optical depth τ" value={radiometry.opticalDepth.toFixed(3)} detail={`Transmittance ${(radiometry.transmittance * 100).toFixed(1)}%`} />
                  <Stat label="Relative luminance I" value={radiometry.relativeLuminance.toFixed(1)} detail={`Raw sky pixel ${stats.avgLuminance.toFixed(1)} / 255`} />
                </div>
                {radiometry.isOverBaseline && (
                  <div className="baseline-alert">
                    <div>
                      <strong>Luminance exceeds baseline I<sub>0</sub>.</strong>
                      <span>This sky is brighter than your clear-sky reference.</span>
                    </div>
                    <button onClick={() => { saveBaseline(radiometry.relativeLuminance); setBaseline(radiometry.relativeLuminance); }}>
                      Set I<sub>0</sub> = {radiometry.relativeLuminance.toFixed(0)}
                    </button>
                  </div>
                )}
                <div className="formula-box">
                  <span>L<sub>rel</sub> = (Y · N²) / (t · ISO)</span>
                  <span>τ = −(1 / m) · ln(I / I<sub>0</sub>)</span>
                  <small>
                    I<sub>0</sub> = {radiometry.baselineI0.toFixed(0)} ({radiometry.isDynamicCalibration ? "Solar elevation model" : "Custom baseline"}) · θ = {radiometry.solarElevationDeg.toFixed(1)}° · m = {radiometry.m.toFixed(2)}
                  </small>
                </div>
              </Panel>
            ) : null}

            {!sceneValidation.sceneValid ? (
              <Panel>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">05 / TRUST</span>
                    <h2>Observation integrity.</h2>
                  </div>
                  <span className="integrity-badge invalid" style={{ background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>REJECTED · 0%</span>
                </div>
                <div className="check-list">
                  <div className="check-row">
                    <span className="check-fail">✕</span>
                    <div>
                      <strong>Atmospheric scene validation failed</strong>
                      <p>{sceneValidation.rejectionReason}</p>
                    </div>
                  </div>
                  <div className="check-row">
                    <span className={sceneValidation.metrics.edgeDensity > 7.5 ? "check-fail" : "check-pass"}>
                      {sceneValidation.metrics.edgeDensity > 7.5 ? "!" : "✓"}
                    </span>
                    <div>
                      <strong>Edge transition density ({sceneValidation.metrics.edgeDensity}%)</strong>
                      <p>{sceneValidation.metrics.edgeDensity > 7.5 ? "High edge density characteristic of synthetic text, code, or user interfaces." : "Edge density within natural sky limits."}</p>
                    </div>
                  </div>
                  <div className="check-row">
                    <span className={sceneValidation.metrics.skinPercentage > 20 ? "check-fail" : "check-pass"}>
                      {sceneValidation.metrics.skinPercentage > 20 ? "!" : "✓"}
                    </span>
                    <div>
                      <strong>Flesh / skin chromaticity ({sceneValidation.metrics.skinPercentage}%)</strong>
                      <p>{sceneValidation.metrics.skinPercentage > 20 ? "Tissue scattering or human subject detected in observation frame." : "No significant flesh chromaticity detected."}</p>
                    </div>
                  </div>
                  <div className="check-row">
                    <span className={sceneValidation.metrics.upperSkyCoverage < 25 ? "check-fail" : "check-pass"}>
                      {sceneValidation.metrics.upperSkyCoverage < 25 ? "!" : "✓"}
                    </span>
                    <div>
                      <strong>Sky coverage ({sceneValidation.metrics.skyCoverage}%, upper {sceneValidation.metrics.upperSkyCoverage}%)</strong>
                      <p>{sceneValidation.metrics.upperSkyCoverage < 25 ? "Insufficient open sky detected in the upper frame." : "Adequate sky coverage detected."}</p>
                    </div>
                  </div>
                </div>
              </Panel>
            ) : observation && air ? (
              <Panel>
                <div className="panel-heading">
                  <div><span className="eyebrow">05 / TRUST</span><h2>Observation integrity.</h2></div>
                  <span className={`integrity-badge ${validation.verdict.toLowerCase()}`}>{validation.verdict} · {validation.score}%</span>
                </div>
                <div className="observation-confidence">
                  <div className="confidence-heading">
                    <div>
                      <span className="corroboration-label">Observation confidence</span>
                      <strong>{observation.observationConfidence}%</strong>
                    </div>
                    <span className={`integrity-badge ${observation.confidenceLevel.toLowerCase().replace(" ", "-")}`}>{observation.confidenceLevel} confidence</span>
                  </div>
                  <p>
                    {air.aqi >= 201 && observation.observationConfidence < 60
                      ? "High pollution estimate with low observation confidence. Cloud or illumination effects may be contributing to the optical attenuation; validate against a nearby reference station."
                      : observation.confidenceLevel === "Very high" || observation.confidenceLevel === "High"
                      ? "Image conditions are suitable for radiometric estimation."
                      : observation.confidenceLevel === "Moderate"
                      ? "Some image conditions may affect the estimate."
                      : "This observation may not reliably represent aerosol loading."}
                  </p>
                  <div className="check-list">
                    {observation.factors.map((factor) => (
                      <div className="check-row" key={factor.name}>
                        <span className={factor.status === "good" ? "check-pass" : "check-fail"}>{factor.status === "good" ? "✓" : "!"}</span>
                        <div>
                          <strong>{factor.name}{factor.impact ? ` (${factor.impact})` : ""}</strong>
                          <p>{factor.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="check-list">
                  {validation.checks.map((check) => (
                    <div className="check-row" key={check.name}>
                      <span className={check.passed ? "check-pass" : "check-fail"}>{check.passed ? "✓" : "!"}</span>
                      <div>
                        <strong>{check.name}</strong>
                        <p>{check.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {!sceneValidation.sceneValid ? (
              <Panel>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">06 / CORROBORATION</span>
                    <h2>Independent signals.</h2>
                  </div>
                </div>
                <div className="corroboration-block">
                  <span className="corroboration-label">Gemma 4 vision</span>
                  <p>Analysis suspended — non-atmospheric image rejected.</p>
                </div>
                <div className="corroboration-block">
                  <span className="corroboration-label">LOCAL REFERENCE</span>
                  <strong>No nearby reference station available.</strong>
                  <p style={{ color: "var(--color-ink-muted-48)", fontSize: "12px", marginTop: "4px" }}>
                    Observation rejected — non-atmospheric image cannot be corroborated against reference monitors.
                  </p>
                  <div className="concordance-line">Reference comparison unavailable</div>
                </div>
              </Panel>
            ) : (
              <Panel>
                <div className="panel-heading">
                  <div><span className="eyebrow">06 / CORROBORATION</span><h2>Independent signals.</h2></div>
                </div>
                <div className="corroboration-block">
                  <span className="corroboration-label">Gemma 4 vision</span>
                  {visionLoading ? (
                    <p>Analyzing sky appearance...</p>
                  ) : vision ? (
                    <>
                      <strong>{vision.hazeSeverity} haze · {vision.aqiCategory}</strong>
                      <p>{vision.hazeDescription}</p>
                      <small>{vision.isSynthetic ? "Local fallback analysis" : "Google Gemma 4 Vision"} · confidence {(vision.aerosolVsCloudConfidence * 100).toFixed(0)}%</small>
                      {vision.fallbackReason && (
                        <div style={{ fontSize: "11px", color: "#8e8e93", marginTop: "4px" }}>
                          ℹ️ {vision.fallbackReason}
                        </div>
                      )}
                    </>
                  ) : (
                    <p>Upload a real image to compare visual haze with the physical estimate.</p>
                  )}
                </div>
                <div className="corroboration-block">
                  <span className="corroboration-label">LOCAL REFERENCE</span>
                  {groundTruthLoading ? (
                    <p>Searching for nearby monitoring stations (&le; 50 km)...</p>
                  ) : groundTruth.referenceKind === "live" && groundTruth.isGeographicallyRelevant && groundTruth.distanceKm !== null ? (
                    <>
                      <strong>{groundTruth.stationName} · PM2.5 {groundTruth.pm25} µg/m³</strong>
                      <p>{groundTruth.distanceKm.toFixed(1)} km away{groundTruth.agencyName ? ` · ${groundTruth.agencyName}` : ""}</p>
                      <small>Updated {formatMinutesAgo(groundTruth.lastUpdated)} · {groundTruth.attribution}</small>
                      {referenceComparison.isDivergent && (
                        <div className="divergence-alert">
                          <span aria-hidden="true">⚠</span>
                          <div>
                            <strong>Significant local divergence</strong>
                            <p>{referenceComparison.divergenceExplanation}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : groundTruth.referenceKind === "preset" && image.isDemo ? (
                    <>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-ink-muted-48)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                        Preset demonstration reference
                      </div>
                      <strong>{groundTruth.stationName} · PM2.5 {groundTruth.pm25} µg/m³</strong>
                      <small style={{ color: "var(--color-ink-muted-48)", marginTop: "4px", display: "block" }}>
                        Demonstration benchmark · {groundTruth.attribution}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>No nearby reference station available.</strong>
                      <p style={{ color: "var(--color-ink-muted-48)", fontSize: "12px", marginTop: "4px" }}>
                        {groundTruth.fallbackReason || "No geographically representative monitoring station was found for this observation."}
                      </p>
                    </>
                  )}
                  {!groundTruthLoading && (
                    <div className="concordance-line">
                      {groundTruth.referenceKind === "live" && groundTruth.isGeographicallyRelevant && referenceComparison.available
                        ? `${referenceComparison.verdict} · ΔAQI ${referenceComparison.deltaAqi}`
                        : "Reference comparison unavailable"}
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </div>
        </div>
      </div></section>
    </main>
    <Footer />
    {showCalibration && <div className="calibration-backdrop" role="dialog" aria-modal="true"><div className="calibration-modal"><div className="panel-heading"><div><span className="eyebrow">REFERENCE RADIANCE</span><h2>Calibrate clear sky.</h2></div><button className="quiet-button" onClick={() => setShowCalibration(false)} aria-label="Close calibration">Close</button></div><p>I<sub>0</sub> is the normalized scene radiance of a pristine sky. Use a cloudless reference photo near solar noon for the most stable result.</p><label>Active baseline I<sub>0</sub><input type="number" min="10" value={calibrationValue} onChange={(event) => setCalibrationValue(event.target.value)} /></label><div className="calibration-actions"><button className="quiet-button" onClick={() => { const value = resetBaseline(); setBaseline(value); setCalibrationValue(String(value)); }}>Reset default</button><button className="button-primary" onClick={saveCalibration}>Save calibration</button></div></div></div>}
  </div>;
}
