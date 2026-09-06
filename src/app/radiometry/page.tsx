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
} from "./radiometryLogic";
import {
  analyzeSkyHazeWithGemini,
  compareRadiometryWithGroundTruth,
  fetchAirQualityForObservation,
  getPresetGroundTruth,
  GroundTruthResult,
  KNOWN_CITIES,
  PRESET_SCENARIOS,
  PresetScenario,
  resolveObservationLocation,
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

  const activeLocation = resolveObservationLocation(exif, locationOverride, image.name);
  const radiometry = calculateRadiometry(
    stats,
    exif,
    baseline,
    overrides,
    {
      latitude: activeLocation?.lat,
      longitude: activeLocation?.lon,
      dateTimeOriginal: exif.parsed.dateTimeOriginal,
    }
  );
  const air = estimateAirQuality(radiometry.opticalDepth);
  const observation = analyzeObservationQuality(stats, exif, radiometry);
  const validation = validateImageAuthenticity(exif, stats);
  const referenceComparison = compareRadiometryWithGroundTruth(air.aqi, groundTruth);

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    setLoading(true); setError(""); setOverrides({});
    const url = URL.createObjectURL(file);
    try {
      const nextExif = await extractExifData(file);
      const img = new Image(); img.src = url;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("The image preview could not be read.")); });
      const nextStats = extractImageLuminance(img);
      setImage({ url, name: file.name, size: file.size, isDemo: false });
      setExif(nextExif);
      setStats(nextStats);

      const obsLocation = resolveObservationLocation(nextExif, locationOverride, file.name);
      const obsTimestamp = nextExif.parsed.dateTimeOriginal && !Number.isNaN(nextExif.parsed.dateTimeOriginal.getTime())
        ? nextExif.parsed.dateTimeOriginal.toISOString()
        : undefined;

      setGroundTruthLoading(true);
      setVisionLoading(true);
      const nextRadiometry = calculateRadiometry(
        nextStats,
        nextExif,
        baseline,
        {},
        {
          latitude: obsLocation?.lat,
          longitude: obsLocation?.lon,
          dateTimeOriginal: nextExif.parsed.dateTimeOriginal,
        }
      );
      const nextAir = estimateAirQuality(nextRadiometry.opticalDepth);

      // Decoupled fetches: OpenAQ ground truth resolution never fails because of Gemini vision
      void fetchAirQualityForObservation(obsLocation, obsTimestamp)
        .then((nextGroundTruth) => setGroundTruth(nextGroundTruth))
        .catch((err) => {
          setGroundTruth(unavailableGroundTruth(obsLocation?.source || "missing_location", err instanceof Error ? err.message : "OpenAQ reference unavailable.", obsTimestamp));
        })
        .finally(() => setGroundTruthLoading(false));

      void analyzeSkyHazeWithGemini(file, { opticalDepth: nextRadiometry.opticalDepth, aqi: nextAir.aqi })
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
    setImage({ url: preset.previewUrl, name: preset.fakeFile.name, size: preset.fakeFile.size, isDemo: true });
    setExif(preset.exif);
    setStats({ avgLuminance: preset.simulatedLuminance, r: preset.simulatedLuminance * .9, g: preset.simulatedLuminance * .95, b: preset.simulatedLuminance, sampleCount: 100000, estimatedSkyPercentage: preset.estimatedSkyPercentage, luminanceStdDev: preset.id === "urban-smog" ? 28 : 45, darkPixelPercentage: 1, clippedPixelPercentage: 0, dynamicRange: 180, upperBrightNeutralPercentage: preset.id === "urban-smog" ? 20 : 4, upperLuminanceStdDev: preset.id === "urban-smog" ? 14 : 35, brightnessGradient: 20 });
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
          .catch(() => setGroundTruth(unavailableGroundTruth("user_selected", "OpenAQ lookup failed.", obsTimestamp)))
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
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          const override = { lat, lon, name: `GPS Location (${lat}°, ${lon}°)` };
          setLocationOverride(override);
          if (!image.isDemo) {
            setGroundTruthLoading(true);
            const obsTimestamp = exif.parsed.dateTimeOriginal && !Number.isNaN(exif.parsed.dateTimeOriginal.getTime())
              ? exif.parsed.dateTimeOriginal.toISOString()
              : undefined;
            void fetchAirQualityForObservation(
              { lat, lon, source: "browser_geolocation", label: override.name },
              obsTimestamp
            )
              .then((gt) => setGroundTruth(gt))
              .finally(() => setGroundTruthLoading(false));
          }
        },
        () => {
          setError("Browser geolocation could not be retrieved.");
        }
      );
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void processFile(file); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void processFile(file); }
  function changeOverride(key: keyof Overrides, value: string) { const parsed = Number(value); setOverrides((current) => ({ ...current, [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined })); }
  function saveCalibration() { const value = Number(calibrationValue); if (value > 0) { saveBaseline(value); setBaseline(value); setShowCalibration(false); } }

  return <div className="radiometry-page">
    <Navigation />
    <main>
      <section className="product-tile-parchment radiometry-intro"><div className="container-wide"><span className="radiometry-kicker">CITIZEN SENSING &bull; INNOVATION 03</span><h1 className="hero-display">Camera Radiometry.</h1><p className="lead">Turn an ordinary sky photograph into a calibrated atmospheric observation.</p><p className="radiometry-intro-note">All core measurements run in your browser. Your image stays on this device while Tropos derives relative scene radiance, aerosol optical depth, and an AQI proxy.</p></div></section>
      <section className="radiometry-workspace"><div className="container-wide">
        <div className="radiometry-toolbar"><div><span className="eyebrow">FIELD INSTRUMENT</span><strong>Sky observation console</strong></div><button className="button-secondary-pill" onClick={() => setShowCalibration(true)}>Calibrate I<sub>0</sub> <span aria-hidden="true">&rarr;</span></button></div>
        <div className="radiometry-presets"><span className="eyebrow">DEMO OBSERVATIONS</span><div>{PRESET_SCENARIOS.map((preset) => <button key={preset.id} onClick={() => selectPreset(preset)}>{preset.title}</button>)}</div></div>
        {error && <div className="radiometry-alert" role="alert">{error}</div>}
        <div className="radiometry-grid">
          <div className="radiometry-column">
            <Panel className="upload-panel"><div className="panel-heading"><div><span className="eyebrow">01 / CAPTURE</span><h2>Bring the sky into focus.</h2></div><span className="panel-mark">A</span></div><input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onInput} hidden /><div className={`radiometry-dropzone ${loading ? "is-loading" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>{loading ? <div className="radiometry-loader"><span />Reading image telemetry...</div> : <><img src={image.url} alt="Current sky observation" /><div className="dropzone-overlay"><span>Replace observation</span><small>Drop a photo or browse your device</small></div></>}</div><div className="upload-meta"><div><strong>{image.name}</strong><span>{(image.size / (1024 * 1024)).toFixed(2)} MB {image.isDemo ? "· Demonstration observation" : "· Local analysis"}</span></div><button className="text-link" onClick={() => inputRef.current?.click()}>Choose another &rarr;</button></div><p className="capture-tip">For a clean reading, point 45°–80° toward the zenith and away from direct sun.</p></Panel>
            <Panel><div className="panel-heading"><div><span className="eyebrow">02 / TELEMETRY</span><h2>Camera signature.</h2></div><button className="quiet-button" onClick={() => setShowManual(!showManual)}>{showManual ? "Close editor" : "Edit values"}</button></div><div className="telemetry-device"><span>Device / camera model</span><strong>{exif.parsed.make || "Unknown make"} <i /> {exif.parsed.model || "Unknown model"}</strong></div><div className="telemetry-grid"><Stat label="Aperture" value={exif.parsed.fNumber ? `f/${exif.parsed.fNumber}` : "Missing"} /><Stat label="ISO sensitivity" value={exif.parsed.iso ? `ISO ${exif.parsed.iso}` : "Missing"} /><Stat label="Shutter speed" value={exif.parsed.exposureTimeDisplay} /></div><div className="telemetry-row"><span>Capture date</span><strong>{exif.parsed.dateTimeOriginalDisplay}</strong></div><div className="telemetry-row"><span>Location signal</span><strong>{activeLocation ? activeLocation.label : "Location unavailable"}</strong></div>{showManual && <div className="manual-editor"><span className="eyebrow">MANUAL OVERRIDE</span><div className="manual-grid"><label>F-number<input type="number" step=".1" min=".9" placeholder={String(exif.parsed.fNumber ?? 2.8)} onChange={(event) => changeOverride("fNumber", event.target.value)} /></label><label>ISO<input type="number" min="25" placeholder={String(exif.parsed.iso ?? 100)} onChange={(event) => changeOverride("iso", event.target.value)} /></label><label>Shutter (s)<input type="number" step=".0005" min=".00001" placeholder={String(exif.parsed.exposureTime ?? .002)} onChange={(event) => changeOverride("exposureTime", event.target.value)} /></label></div><div style={{ marginTop: "12px" }}><label style={{ display: "grid", gap: "6px", fontSize: "11px", color: "var(--color-ink-muted-48)" }}>City / Observation Location<div style={{ display: "flex", gap: "8px" }}><select style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid var(--color-hairline)", background: "#fff", color: "var(--color-ink)", font: "inherit", fontSize: "12px" }} value={locationOverride?.name ? Object.keys(KNOWN_CITIES).find(k => KNOWN_CITIES[k].name === locationOverride.name) || "" : ""} onChange={(e) => selectCityOverride(e.target.value)}><option value="">{exif.parsed.gpsLatitude ? "Photo GPS telemetry" : "Select location…"}</option><option value="indore">Vijay Nagar, Indore</option><option value="delhi">Delhi NCR</option><option value="gurugram">Gurugram</option><option value="noida">Noida</option><option value="mumbai">Mumbai</option><option value="bengaluru">Bengaluru</option></select><button type="button" className="quiet-button" style={{ fontSize: "11px", whiteSpace: "nowrap" }} onClick={detectBrowserLocation}>Use GPS</button></div></label></div></div>}{exif.warnings.length > 0 && <p className="telemetry-warning">{exif.warnings[0]}</p>}</Panel>
          </div>
          <div className="radiometry-column">
            <Panel className="aq-panel"><div className="panel-heading"><div><span className="eyebrow">03 / ATMOSPHERE</span><h2>Air quality estimate.</h2></div><span className="quality-badge">{air.category}</span></div><div className="aq-hero"><div><span>Estimated AQI</span><strong>{air.aqi}</strong></div><div><span>PM2.5 mass proxy</span><strong>{air.pm25Proxy} <small>µg/m³</small></strong><em>AOD τ {air.tau.toFixed(3)}</em></div></div><div className="aq-scale"><i /><i /><i /><i /><i /><i /></div><p>{air.description}</p><div className="aq-advisory"><strong>Health recommendation</strong>{air.advisory}</div></Panel>
            <Panel><div className="panel-heading"><div><span className="eyebrow">04 / PHYSICS</span><h2>Radiometry result.</h2></div><span className="formula-chip">Beer–Lambert</span></div><div className="metric-grid"><Stat label="Aerosol optical depth τ" value={radiometry.opticalDepth.toFixed(3)} detail={`Transmittance ${(radiometry.transmittance * 100).toFixed(1)}%`} /><Stat label="Relative luminance I" value={radiometry.relativeLuminance.toFixed(1)} detail={`Raw sky pixel ${stats.avgLuminance.toFixed(1)} / 255`} /></div>{radiometry.isOverBaseline && <div className="baseline-alert"><div><strong>Luminance exceeds baseline I<sub>0</sub>.</strong><span>This sky is brighter than your clear-sky reference.</span></div><button onClick={() => { saveBaseline(radiometry.relativeLuminance); setBaseline(radiometry.relativeLuminance); }}>Set I<sub>0</sub> = {radiometry.relativeLuminance.toFixed(0)}</button></div>}<div className="formula-box"><span>L<sub>rel</sub> = (Y · N²) / (t · ISO)</span><span>τ = −(1 / m) · ln(I / I<sub>0</sub>)</span><small>I<sub>0</sub> = {radiometry.baselineI0.toFixed(0)} ({radiometry.isDynamicCalibration ? "Solar elevation model" : "Custom baseline"}) · θ = {radiometry.solarElevationDeg.toFixed(1)}° · m = {radiometry.m.toFixed(2)}</small></div></Panel>
            <Panel><div className="panel-heading"><div><span className="eyebrow">05 / TRUST</span><h2>Observation integrity.</h2></div><span className={`integrity-badge ${validation.verdict.toLowerCase()}`}>{validation.verdict} · {validation.score}%</span></div><div className="observation-confidence"><div className="confidence-heading"><div><span className="corroboration-label">Observation confidence</span><strong>{observation.observationConfidence}%</strong></div><span className={`integrity-badge ${observation.confidenceLevel.toLowerCase().replace(" ", "-")}`}>{observation.confidenceLevel} confidence</span></div><p>{air.aqi >= 201 && observation.observationConfidence < 60 ? "High pollution estimate with low observation confidence. Cloud or illumination effects may be contributing to the optical attenuation; validate against a nearby reference station." : observation.confidenceLevel === "Very high" || observation.confidenceLevel === "High" ? "Image conditions are suitable for radiometric estimation." : observation.confidenceLevel === "Moderate" ? "Some image conditions may affect the estimate." : "This observation may not reliably represent aerosol loading."}</p><div className="check-list">{observation.factors.map((factor) => <div className="check-row" key={factor.name}><span className={factor.status === "good" ? "check-pass" : "check-fail"}>{factor.status === "good" ? "✓" : "!"}</span><div><strong>{factor.name}{factor.impact ? ` (${factor.impact})` : ""}</strong><p>{factor.explanation}</p></div></div>)}</div></div><div className="check-list">{validation.checks.map((check) => <div className="check-row" key={check.name}><span className={check.passed ? "check-pass" : "check-fail"}>{check.passed ? "✓" : "!"}</span><div><strong>{check.name}</strong><p>{check.message}</p></div></div>)}</div></Panel>
            <Panel><div className="panel-heading"><div><span className="eyebrow">06 / CORROBORATION</span><h2>Independent signals.</h2></div></div><div className="corroboration-block"><span className="corroboration-label">Gemini vision</span>{visionLoading ? <p>Analyzing sky appearance...</p> : vision ? <><strong>{vision.hazeSeverity} haze · {vision.aqiCategory}</strong><p>{vision.hazeDescription}</p><small>{vision.isSynthetic ? "Local fallback analysis" : "Gemini Vision analysis"} · confidence {(vision.aerosolVsCloudConfidence * 100).toFixed(0)}%</small></> : <p>Upload a real image to compare visual haze with the physical estimate.</p>}</div><div className="corroboration-block"><span className="corroboration-label">{groundTruth.referenceKind === "live" ? "Nearest OpenAQ station" : "Reference station"}</span>{groundTruthLoading ? <p>Fetching nearby OpenAQ data...</p> : groundTruth.referenceKind === "live" && groundTruth.isGeographicallyRelevant && groundTruth.distanceKm !== null ? <><strong>{groundTruth.stationName} · PM2.5 {groundTruth.pm25} µg/m³</strong><p>{groundTruth.distanceKm.toFixed(1)} km away</p><small>Valid local reference · {groundTruth.attribution}</small></> : groundTruth.referenceKind === "preset" ? <><div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-ink-muted-48)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Preset fallback reference</div><strong>{groundTruth.stationName} · PM2.5 {groundTruth.pm25} µg/m³</strong><small style={{ color: "#a33b3b", marginTop: "4px", display: "block" }}>⚠ This reference is not geographically representative of the current observation.</small></> : <><strong>Unavailable</strong><p style={{ color: "#a33b3b", fontSize: "12px", marginTop: "4px" }}>⚠ {groundTruth.fallbackReason || "Image location unavailable. A geographically valid OpenAQ reference could not be selected."}</p></>}{!groundTruthLoading && <div className="concordance-line">{referenceComparison.available ? `${referenceComparison.verdict} · ΔAQI ${referenceComparison.deltaAqi}` : "Reference comparison unavailable"}</div>}</div><div className="corroboration-block" style={{ marginTop: "14px", borderTop: "1px solid var(--color-hairline)", paddingTop: "12px" }}><span className="corroboration-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span>Google Earth Engine (GEE) Orbital Truth</span><span style={{ color: "#16a34a", fontSize: "10px", fontWeight: 700 }}>● S5P TROPOMI</span></span>{(() => { const lat = activeLocation?.lat ?? 28.6139; const lng = activeLocation?.lon ?? 77.2090; const gee = getGeeOrbitalAnchorForCoordinate(lat, lng); const cameraTau = radiometry.opticalDepth; const geeTau = gee.orbitalAod; const diff = Math.abs(cameraTau - geeTau); const concordance = Math.max(0, Math.round((1 - diff / Math.max(cameraTau, geeTau, 0.5)) * 100)); return <div style={{ marginTop: "6px" }}><strong>GEE Orbital AOD: {gee.orbitalAod.toFixed(2)} (AAI +{gee.aai.toFixed(2)})</strong><p style={{ fontSize: "12px", color: "var(--color-ink-muted-48)", margin: "2px 0 4px" }}>Camera τ {cameraTau.toFixed(2)} vs GEE Orbital τ {geeTau.toFixed(2)} · {concordance}% Alignment</p><small style={{ color: "var(--color-ink-muted-48)", display: "block", fontSize: "10px" }}>Harmonized via {gee.dataset}</small></div>; })()}</div></Panel>
          </div>
        </div>
      </div></section>
    </main>
    <Footer />
    {showCalibration && <div className="calibration-backdrop" role="dialog" aria-modal="true"><div className="calibration-modal"><div className="panel-heading"><div><span className="eyebrow">REFERENCE RADIANCE</span><h2>Calibrate clear sky.</h2></div><button className="quiet-button" onClick={() => setShowCalibration(false)} aria-label="Close calibration">Close</button></div><p>I<sub>0</sub> is the normalized scene radiance of a pristine sky. Use a cloudless reference photo near solar noon for the most stable result.</p><label>Active baseline I<sub>0</sub><input type="number" min="10" value={calibrationValue} onChange={(event) => setCalibrationValue(event.target.value)} /></label><div className="calibration-actions"><button className="quiet-button" onClick={() => { const value = resetBaseline(); setBaseline(value); setCalibrationValue(String(value)); }}>Reset default</button><button className="button-primary" onClick={saveCalibration}>Save calibration</button></div></div></div>}
  </div>;
}
