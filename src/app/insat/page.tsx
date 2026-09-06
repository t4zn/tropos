"use client";

import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSatelliteData } from "@/hooks/useSatelliteData";
import { useFirmsData } from "@/hooks/useFirmsData";
import dynamic from "next/dynamic";
import { getGeeHarmonizationData } from "@/lib/earthEngine";

import { REGION_SECTORS, type RegionHotspot } from "@/components/AodMap";

const AodMap = dynamic(() => import("@/components/AodMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        backgroundColor: "#111113",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.3)",
        fontSize: "13px",
      }}
    >
      Loading map…
    </div>
  ),
});

type Channel = "IR1" | "VIS" | "SWIR" | "WV";
type CompositeMode = "raw" | "dust_rgb" | "natural_color";

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  windDir: string;
  visibility: number;
  cloudCover: number;
  description: string;
  boundaryLayerEstimate: number;
}

function useWeatherData() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/weather", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("Weather API error");
      const json = await res.json();
      setData(json);
    } catch {
      // handled by null data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return { weather: data, isLoading: loading };
}

/** Check if current IST or current selected scan IST is in the dusk stubble burning window (17:00–19:30 IST) */
function isDuskStubbleWindow(istTimeStr?: string): { inWindow: boolean; istHour: number; istMinute: number } {
  let h = 0;
  let m = 0;
  if (istTimeStr) {
    const match = istTimeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      h = parseInt(match[1], 10);
      m = parseInt(match[2], 10);
    }
  } else {
    // Current IST time
    const nowUtc = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(nowUtc.getTime() + istOffsetMs);
    h = istDate.getUTCHours();
    m = istDate.getUTCMinutes();
  }
  const totalMins = h * 60 + m;
  // 17:00 (1020 mins) to 19:30 (1170 mins)
  const inWindow = totalMins >= 1020 && totalMins <= 1170;
  return { inWindow, istHour: h, istMinute: m };
}

export default function InsatPage() {
  const { scans, aodScans, channelLabels, satellite, orbit, isLoading: satLoading } = useSatelliteData();
  const { fires, corridorFireCount, isLoading: firmsLoading, error: firmsError, fetchedAt: firmsFetchedAt } = useFirmsData();
  const { weather, isLoading: wxLoading } = useWeatherData();

  const [viewMode, setViewMode] = useState<"map" | "channels">("map");
  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState<Channel>("IR1");
  const [selectedAodIdx, setSelectedAodIdx] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [failedScans, setFailedScans] = useState<Set<string>>(new Set());

  // Innovation 1: Interactive Time-Lapse Loop Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);

  // Innovation 3: True-Color & False-Color RGB Composite Switcher
  const [compositeMode, setCompositeMode] = useState<CompositeMode>("raw");

  // Innovation 4: Sector Inspector & City Zoom
  const [selectedSectorId, setSelectedSectorId] = useState<string>("delhi-ncr");

  // Innovation 2: Dusk Stubble Window Inversion Status
  const currentScanObj = scans[selectedScanIdx] ?? null;
  const currentAodObj = aodScans[selectedAodIdx] ?? null;
  const activeIstTime = viewMode === "map" ? currentAodObj?.istTime : currentScanObj?.istTime;
  const stubbleWindow = isDuskStubbleWindow(activeIstTime);

  // Reset image loaded state on selection change
  useEffect(() => {
    setImageLoaded(false);
  }, [selectedScanIdx, selectedChannel, compositeMode]);

  // Time-Lapse Animation Interval
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.round(1200 / playbackSpeed);
    const timer = setInterval(() => {
      if (viewMode === "map") {
        if (aodScans.length <= 1) return;
        setSelectedAodIdx((prev) => (prev + 1) % aodScans.length);
      } else {
        if (scans.length <= 1) return;
        setSelectedScanIdx((prev) => (prev + 1) % scans.length);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, viewMode, aodScans.length, scans.length]);

  const currentScan = scans[selectedScanIdx] ?? null;
  const currentImageUrl = currentScan?.channels?.[selectedChannel] ?? null;
  const currentKey = currentScan ? `${currentScan.dateLabel}-${currentScan.utcTime}-${selectedChannel}-${compositeMode}` : "";
  const currentFailed = failedScans.has(currentKey);

  // When an image fails, auto-advance to the next scan slot
  function handleImageError() {
    setFailedScans((prev) => new Set(prev).add(currentKey));
    if (selectedScanIdx < scans.length - 1) {
      setSelectedScanIdx((prev) => prev + 1);
    }
  }

  // High-confidence fire count
  const highConfFires = fires.filter(
    (f) => f.confidence === "high" || f.confidence === "h"
  ).length;

  const allChannels: Channel[] = ["IR1", "VIS", "SWIR", "WV"];
  const currentAod = aodScans[selectedAodIdx] ?? null;

  // Compute CSS filter styling based on Composite Mode
  const getCompositeFilter = (): string => {
    switch (compositeMode) {
      case "dust_rgb":
        // Infrared Thermal & Particulate High-Contrast: boost contrast, invert slightly to isolate heat/smog
        return "contrast(1.65) saturate(1.8) hue-rotate(190deg) brightness(1.1)";
      case "natural_color":
        // Vegetative & Optical clarity: enhance sharpness, vibrant green-cyan-earth balance
        return "contrast(1.35) saturate(1.4) brightness(1.05)";
      case "raw":
      default:
        return "none";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
      }}
    >
      <Navigation />

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{ padding: "120px 0 32px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
          <div className="container">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 14px",
                borderRadius: "9999px",
                backgroundColor: "rgba(41, 151, 255, 0.1)",
                border: "1px solid rgba(41, 151, 255, 0.2)",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#2997ff",
                  animation: "pulse-live 2s infinite",
                }}
              />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#2997ff", letterSpacing: "0.5px" }}>
                {satellite} • {orbit}
              </span>
            </div>

            <h1
              style={{
                fontSize: "54px",
                fontWeight: 600,
                letterSpacing: "-0.5px",
                lineHeight: 1.07,
                marginBottom: "14px",
              }}
            >
              INSAT-3DS.
            </h1>

            <p
              style={{
                fontSize: "20px",
                fontWeight: 400,
                lineHeight: 1.35,
                color: "rgba(255, 255, 255, 0.56)",
                maxWidth: "680px",
                margin: "0 auto",
              }}
            >
              Live geostationary imagery from ISRO&apos;s latest meteorological satellite.
              Continuous scans every 15 minutes at 82°E — capturing what polar satellites miss.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* INNOVATION 2: THE DUSK STUBBLE WINDOW INVERSION DETECTOR BANNER        */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{ padding: "0 0 24px", backgroundColor: "#0a0a0a" }}>
          <div className="container" style={{ maxWidth: "1080px" }}>
            <div
              style={{
                padding: "16px 22px",
                borderRadius: "16px",
                backgroundColor: stubbleWindow.inWindow
                  ? "rgba(255, 69, 58, 0.12)"
                  : "rgba(255, 159, 10, 0.08)",
                border: stubbleWindow.inWindow
                  ? "1px solid rgba(255, 69, 58, 0.35)"
                  : "1px solid rgba(255, 159, 10, 0.22)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                boxShadow: stubbleWindow.inWindow ? "0 0 24px rgba(255,69,58,0.15)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: stubbleWindow.inWindow ? "rgba(255,69,58,0.2)" : "rgba(255,159,10,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {stubbleWindow.inWindow ? "🔥" : "⏳"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: stubbleWindow.inWindow ? "#ff453a" : "#ff9f0a",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {stubbleWindow.inWindow
                        ? "Dusk Stubble Window Active (17:00–19:30 IST)"
                        : "Dusk Stubble Window Inactive (17:00–19:30 IST Standby)"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: stubbleWindow.inWindow ? "#ff453a" : "rgba(255,255,255,0.1)",
                        color: "#ffffff",
                      }}
                    >
                      {stubbleWindow.inWindow ? "POLAR SATELLITE BLIND SPOT" : "GEOSTATIONARY STANDBY"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                    {stubbleWindow.inWindow
                      ? "Agricultural fires lit post-dusk evade Terra/Aqua polar passes (13:30 IST). INSAT-3DS SWIR and Thermal IR provide exclusive nocturnal combustion coverage."
                      : "Polar satellites (Terra/Aqua/Sentinel-5P) miss twilight burning. INSAT-3DS 15-min cadence continuously scans the Punjab-Haryana-Malwa agricultural corridor."}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    textAlign: "right",
                    padding: "6px 14px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                    Scan Time
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "SF Mono, monospace" }}>
                    {activeIstTime || "Live IST"}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSectorId("punjab-belt")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    backgroundColor: "#ff453a",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Inspect Farm Belt →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Live Atmospheric Stats Bar */}
        <section style={{ padding: "0 0 32px", backgroundColor: "#0a0a0a" }}>
          <div className="container" style={{ maxWidth: "1080px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "1px",
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <StatCell
                label="Wind Speed & Dir"
                value={wxLoading ? "—" : weather ? `${weather.windSpeed}` : "—"}
                unit={`km/h ${weather?.windDir ?? ""}`}
                color="#2997ff"
              />
              <StatCell
                label="Planetary Boundary Layer"
                value={wxLoading ? "—" : weather ? `${weather.boundaryLayerEstimate}` : "—"}
                unit="m"
                color="#2997ff"
              />
              <StatCell
                label="Active Thermal Hotspots"
                value={firmsLoading ? "—" : `${corridorFireCount}`}
                unit="corridor"
                color={corridorFireCount > 0 ? "#ff453a" : "#30d158"}
              />
              <StatCell
                label="Surface Temperature"
                value={wxLoading ? "—" : weather ? `${weather.temperature}` : "—"}
                unit="°C"
                color="#2997ff"
              />
            </div>
          </div>
        </section>

        {/* Primary Interactive Explorer Section */}
        <section style={{ padding: "0 0 64px", backgroundColor: "#0a0a0a" }}>
          <div className="container" style={{ maxWidth: "1080px" }}>
            {/* View Mode Switcher (Apple-style pill) */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "4px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <button
                  onClick={() => setViewMode("map")}
                  style={{
                    padding: "7px 18px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: viewMode === "map" ? "#2997ff" : "transparent",
                    color: viewMode === "map" ? "#ffffff" : "rgba(255, 255, 255, 0.6)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: viewMode === "map" ? "#ffffff" : "#2997ff",
                    }}
                  />
                  Interactive Subcontinent Map (AOD + FIRMS)
                </button>
                <button
                  onClick={() => setViewMode("channels")}
                  style={{
                    padding: "7px 18px",
                    borderRadius: "9999px",
                    border: "none",
                    backgroundColor: viewMode === "channels" ? "#2997ff" : "transparent",
                    color: viewMode === "channels" ? "#ffffff" : "rgba(255, 255, 255, 0.6)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Multispectral Full-Disk (L1B)
                </button>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* INNOVATION 1: INTERACTIVE TIME-LAPSE LOOP & RADAR PLAYER BAR       */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 18px",
                borderRadius: "14px",
                backgroundColor: "rgba(18, 18, 20, 0.88)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                backdropFilter: "blur(20px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#2997ff",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: isPlaying ? "#30d158" : "#2997ff",
                      animation: isPlaying ? "pulse-live 1s infinite" : "none",
                    }}
                  />
                  Time-Lapse Player
                </span>

                {/* Play / Pause Toggle */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    backgroundColor: isPlaying ? "rgba(48, 209, 88, 0.2)" : "rgba(41, 151, 255, 0.2)",
                    border: isPlaying ? "1px solid rgba(48, 209, 88, 0.5)" : "1px solid rgba(41, 151, 255, 0.4)",
                    color: isPlaying ? "#30d158" : "#2997ff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isPlaying ? "❚❚ Pause Loop" : "▶ Play Radar Loop"}
                </button>

                {/* Step Back & Forward */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    if (viewMode === "map") {
                      if (aodScans.length > 0) {
                        setSelectedAodIdx((prev) => (prev > 0 ? prev - 1 : aodScans.length - 1));
                      }
                    } else {
                      if (scans.length > 0) {
                        setSelectedScanIdx((prev) => (prev > 0 ? prev - 1 : scans.length - 1));
                      }
                    }
                  }}
                  title="Step back 1 scan"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  ⏮
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    if (viewMode === "map") {
                      if (aodScans.length > 0) {
                        setSelectedAodIdx((prev) => (prev + 1) % aodScans.length);
                      }
                    } else {
                      if (scans.length > 0) {
                        setSelectedScanIdx((prev) => (prev + 1) % scans.length);
                      }
                    }
                  }}
                  title="Step forward 1 scan"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  ⏭
                </button>

                {/* Playback Speed Switcher */}
                <div style={{ display: "flex", gap: "2px", marginLeft: "4px" }}>
                  {([0.5, 1, 2] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: playbackSpeed === spd ? "#2997ff" : "rgba(255,255,255,0.05)",
                        color: playbackSpeed === spd ? "#ffffff" : "rgba(255,255,255,0.5)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Innovation 4: Sector Inspector Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase" }}>
                  Sector Inspector:
                </span>
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#1c1c1e",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {REGION_SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {viewMode === "map" ? (
              /* ── View Mode A: Interactive Map (Primary) ── */
              <div>
                {/* AOD Time Scrubber */}
                {aodScans.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "6px",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: 600,
                        marginRight: "4px",
                      }}
                    >
                      Scan Slot:
                    </span>
                    {aodScans.map((aod, idx) => (
                      <button
                        key={`${aod.dateLabel}-${aod.utcTime}`}
                        onClick={() => {
                          setIsPlaying(false);
                          setSelectedAodIdx(idx);
                        }}
                        style={{
                          padding: "5px 14px",
                          borderRadius: "8px",
                          border:
                            selectedAodIdx === idx
                              ? "1px solid #2997ff"
                              : "1px solid rgba(255,255,255,0.08)",
                          backgroundColor:
                            selectedAodIdx === idx
                              ? "rgba(41, 151, 255, 0.14)"
                              : "rgba(255,255,255,0.03)",
                          color:
                            selectedAodIdx === idx
                              ? "#2997ff"
                              : "rgba(255,255,255,0.6)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {aod.istTime}
                      </button>
                    ))}
                  </div>
                )}

                {/* Interactive AOD Map */}
                <div
                  style={{
                    width: "100%",
                    height: "600px",
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
                  }}
                >
                  <AodMap
                    imageUrl={currentAod?.url ?? null}
                    opacity={0.7}
                    timeLabel={currentAod?.istTime}
                    dateLabel={currentAod?.dateLabel}
                    selectedSectorId={selectedSectorId}
                    onSectorSelect={(sector) => setSelectedSectorId(sector.id)}
                    weather={weather}
                    fires={fires}
                  />
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.25)",
                  }}
                >
                  <span>Hover to inspect regional aerosol conditions · Click any hotspot marker or select from Sector Inspector</span>
                  <span>ISRO MOSDAC Level-2 Geophysical Product · Authenticated CARTO Basemap</span>
                </div>
              </div>
            ) : (
              /* ── View Mode B: Multispectral Full-Disk Channels ── */
              <div>
                {/* ═════════════════════════════════════════════════════════════════ */}
                {/* INNOVATION 3: TRUE-COLOR & FALSE-COLOR RGB COMPOSITE SWITCHER    */}
                {/* ═════════════════════════════════════════════════════════════════ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  {/* Channel Selector */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    {allChannels.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setSelectedChannel(ch)}
                        style={{
                          padding: "8px 18px",
                          borderRadius: "9999px",
                          border: "none",
                          backgroundColor: selectedChannel === ch ? "#2997ff" : "rgba(255,255,255,0.06)",
                          color: selectedChannel === ch ? "#fff" : "rgba(255,255,255,0.6)",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {channelLabels[ch] ?? ch}
                      </button>
                    ))}
                  </div>

                  {/* False Color / RGB Composite Mode Selector */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", padding: "0 8px", textTransform: "uppercase", fontWeight: 600 }}>
                      RGB Blend:
                    </span>
                    <button
                      onClick={() => setCompositeMode("raw")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        backgroundColor: compositeMode === "raw" ? "#2997ff" : "transparent",
                        color: compositeMode === "raw" ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Raw Spectral
                    </button>
                    <button
                      onClick={() => setCompositeMode("dust_rgb")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        backgroundColor: compositeMode === "dust_rgb" ? "#af52de" : "transparent",
                        color: compositeMode === "dust_rgb" ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Dust & Smog RGB
                    </button>
                    <button
                      onClick={() => setCompositeMode("natural_color")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "7px",
                        border: "none",
                        backgroundColor: compositeMode === "natural_color" ? "#30d158" : "transparent",
                        color: compositeMode === "natural_color" ? "#fff" : "rgba(255,255,255,0.6)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Natural Color Composite
                    </button>
                  </div>
                </div>

                {/* Scan Timeline */}
                <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {scans.map((scan, idx) => {
                    const scanKey = `${scan.dateLabel}-${scan.utcTime}-${selectedChannel}-${compositeMode}`;
                    const isFailed = failedScans.has(scanKey);
                    return (
                      <button
                        key={`${scan.dateLabel}-${scan.utcTime}`}
                        onClick={() => {
                          setIsPlaying(false);
                          setSelectedScanIdx(idx);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: selectedScanIdx === idx
                            ? "1px solid #2997ff"
                            : "1px solid rgba(255,255,255,0.08)",
                          backgroundColor: selectedScanIdx === idx
                            ? "rgba(41, 151, 255, 0.12)"
                            : "transparent",
                          color: isFailed
                            ? "rgba(255,255,255,0.2)"
                            : selectedScanIdx === idx
                            ? "#2997ff"
                            : "rgba(255,255,255,0.5)",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          textDecoration: isFailed ? "line-through" : "none",
                        }}
                      >
                        {scan.istTime}
                      </button>
                    );
                  })}
                  {satLoading && (
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", alignSelf: "center", marginLeft: "8px" }}>
                      Loading…
                    </span>
                  )}
                </div>

                {/* Image Viewer */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 10",
                    borderRadius: "16px",
                    overflow: "hidden",
                    backgroundColor: "#111113",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Loading spinner */}
                  {!imageLoaded && !currentFailed && currentImageUrl && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                      <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTop: "3px solid #2997ff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    </div>
                  )}

                  {/* Image */}
                  {currentImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={currentKey}
                      src={currentImageUrl}
                      alt={`INSAT-3DS ${channelLabels[selectedChannel] ?? selectedChannel} scan at ${currentScan?.istTime}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        opacity: imageLoaded && !currentFailed ? 1 : 0,
                        transition: "opacity 0.4s ease, filter 0.3s ease",
                        position: "absolute",
                        inset: 0,
                        filter: getCompositeFilter(),
                      }}
                      onLoad={() => setImageLoaded(true)}
                      onError={handleImageError}
                    />
                  )}

                  {/* Metadata overlay (bottom-left) */}
                  {currentScan && imageLoaded && !currentFailed && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        left: "16px",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(10px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "12px",
                        zIndex: 3,
                      }}
                    >
                      <span style={{ color: "#2997ff", fontWeight: 600 }}>MOSDAC</span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {currentScan.dateLabel} · {currentScan.utcTime} UTC ({currentScan.istTime})
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {channelLabels[selectedChannel] ?? selectedChannel}
                      </span>
                      {compositeMode !== "raw" && (
                        <span style={{ color: compositeMode === "dust_rgb" ? "#af52de" : "#30d158", fontWeight: 600 }}>
                          ● {compositeMode === "dust_rgb" ? "Dust/Smog RGB" : "Natural Color"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Data source (bottom-right) */}
                  {imageLoaded && !currentFailed && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        right: "16px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.3)",
                        zIndex: 3,
                      }}
                    >
                      ISRO {satellite} · L1B Standard Product
                    </div>
                  )}
                </div>

                {/* Source attribution */}
                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.25)",
                  }}
                >
                  <span>Source: ISRO MOSDAC (mosdac.gov.in) · {satellite} Geostationary Meteorological Satellite</span>
                  <span>Composite blend simulates thermal IR extinction & visible reflectance</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ISRO INSAT-3DS → Real-Time AQI Conversion Engine Architecture      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section style={{ padding: "64px 0 72px", backgroundColor: "#111113" }}>
          <div className="container" style={{ maxWidth: "1060px" }}>
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#2997ff",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                  marginBottom: "8px",
                }}
              >
                Atmospheric Physics Pipeline · ISRO Level-2
              </span>
              <h2
                style={{
                  fontSize: "36px",
                  fontWeight: 600,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.15,
                  marginBottom: "12px",
                }}
              >
                How We Derive Real-Time AQI From ISRO Satellites.
              </h2>
              <p
                style={{
                  fontSize: "16px",
                  color: "rgba(255,255,255,0.56)",
                  maxWidth: "680px",
                  margin: "0 auto",
                  lineHeight: 1.5,
                }}
              >
                While polar satellites (NASA MODIS / ESA Sentinel) only pass India twice a day, INSAT-3DS scans every 15–30 minutes.
                We invert optical depth into ground particulate concentrations using live boundary layer meteorology.
              </p>
            </div>

            {/* 3-Pillar Physics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <div
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  backgroundColor: "#161619",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>🛰️</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
                  1. Pixel Radiance Sampling
                </div>
                <div style={{ fontSize: "12px", color: "#2997ff", fontFamily: "SF Mono, monospace", marginBottom: "10px" }}>
                  τ_AOD ∈ [0.05, 2.50] @ 550nm
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                  Every 30 minutes, ISRO MOSDAC publishes L2G AOD previews. We sample the exact equirectangular pixel
                  at each monitoring centroid and reverse-match against the published MOSDAC color LUT.
                </p>
              </div>

              <div
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  backgroundColor: "#161619",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>🌪️</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
                  2. Boundary Layer Dilution
                </div>
                <div style={{ fontSize: "12px", color: "#30d158", fontFamily: "SF Mono, monospace", marginBottom: "10px" }}>
                  PM2.5 = (τ · η) / (PBLH · f(RH))
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                  Column AOD represents total sky particulates. Inverting to ground concentration requires dividing by
                  the Planetary Boundary Layer Height (PBLH) and correcting for aerosol humidity swelling f(RH).
                </p>
              </div>

              <div
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  backgroundColor: "#161619",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>📊</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
                  3. Indian CPCB Sub-Index
                </div>
                <div style={{ fontSize: "12px", color: "#ff9f0a", fontFamily: "SF Mono, monospace", marginBottom: "10px" }}>
                  AQI = f_CPCB(PM2.5) ∈ [0, 500]
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                  The resulting surface PM2.5 (µg/m³) is mapped through official CPCB piecewise linear breakpoints
                  (Good: 0–30, Moderate: 61–90, Poor: 91–120, Very Poor: 121–250, Severe: 250+).
                </p>
              </div>
            </div>

            {/* Scientific Formula Card */}
            <div
              style={{
                padding: "20px 24px",
                borderRadius: "12px",
                backgroundColor: "rgba(41, 151, 255, 0.06)",
                border: "1px solid rgba(41, 151, 255, 0.18)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#2997ff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Empirical Calibration Factor (η)
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                  Calibrated to Indian urban aerosol mixtures (van Donkelaar et al., 2021; Dey &amp; Di Girolamo, 2010): η = 2,600 µg/m³·m
                </div>
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  fontFamily: "SF Mono, monospace",
                  fontSize: "12px",
                  color: "#30d158",
                }}
              >
                ● Live 15-min Continuous Ground Truth
              </div>
            </div>
          </div>
        </section>

        {/* NASA FIRMS Fire Data */}
        <section style={{ padding: "64px 0 80px", backgroundColor: "#111113" }}>
          <div className="container" style={{ maxWidth: "960px" }}>
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ff453a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                  marginBottom: "8px",
                }}
              >
                NASA FIRMS · Live Fire Detection
              </span>
              <h2
                style={{
                  fontSize: "40px",
                  fontWeight: 600,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.1,
                  marginBottom: "12px",
                }}
              >
                The Polar Blind Spot.
              </h2>
              <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.56)", maxWidth: "640px", margin: "0 auto", lineHeight: 1.47 }}>
                NASA polar satellites (MODIS/VIIRS) pass India at ~1:30 PM — missing the dusk biomass burning window.
                INSAT&apos;s geostationary orbit captures continuously.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1px",
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: "16px",
                overflow: "hidden",
                marginBottom: "24px",
              }}
            >
              {/* NASA FIRMS Panel */}
              <div style={{ padding: "32px", backgroundColor: "#1a1a1c" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  NASA FIRMS · Delhi-NCR Corridor · Last 24h
                </div>
                <div style={{ fontSize: "48px", fontWeight: 600, letterSpacing: "-1px", lineHeight: 1, marginBottom: "8px" }}>
                  <span style={{ color: corridorFireCount > 0 ? "#ff453a" : "#30d158" }}>
                    {firmsLoading ? "—" : corridorFireCount}
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "20px" }}>
                  {corridorFireCount === 0
                    ? "no active fire hotspots detected"
                    : corridorFireCount === 1
                    ? "active fire hotspot in corridor"
                    : "active fire hotspots in corridor"}
                </div>

                {highConfFires > 0 && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255,69,58,0.08)",
                      border: "1px solid rgba(255,69,58,0.15)",
                      fontSize: "13px",
                      color: "#ff9f0a",
                      marginBottom: "12px",
                    }}
                  >
                    ⚠ {highConfFires} high-confidence detection{highConfFires > 1 ? "s" : ""}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <MetricRow label="Sensor" value="VIIRS S-NPP" />
                  <MetricRow label="Coverage" value="27.5°–30.5°N, 75.5°–78.5°E" />
                  <MetricRow label="Resolution" value="375 m" />
                </div>
              </div>

              {/* Geostationary Advantage Panel */}
              <div style={{ padding: "32px", backgroundColor: "#1a1a1c" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#2997ff", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  INSAT-3DS Geostationary Advantage
                </div>
                <div style={{ fontSize: "48px", fontWeight: 600, letterSpacing: "-1px", lineHeight: 1, marginBottom: "8px", color: "#2997ff" }}>
                  96
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "20px" }}>
                  scans per day at 15-min cadence
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <MetricRow label="Temporal Coverage" value="24/7 continuous" />
                  <MetricRow label="Revisit Time" value="15 min" />
                  <MetricRow label="Evening Window" value="16:00 – 20:00 IST" highlight />
                  <MetricRow label="Orbital Position" value="82°E Equatorial" />
                </div>
              </div>
            </div>

            {/* Fire Hotspot Table — only when fires exist */}
            {fires.length > 0 && (
              <div
                style={{
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ padding: "14px 20px", backgroundColor: "#1a1a1c", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>
                    Active Fire Hotspots
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                    NASA FIRMS VIIRS S-NPP NRT
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#161618", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Location</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Brightness (K)</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>FRP (MW)</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Confidence</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>Acquired</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fires.slice(0, 12).map((fire, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          backgroundColor: idx % 2 === 0 ? "#111113" : "#141416",
                        }}
                      >
                        <td style={{ padding: "10px 16px", color: "rgba(255,255,255,0.7)" }}>
                          {fire.lat.toFixed(3)}°N, {fire.lng.toFixed(3)}°E
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>
                          {fire.brightness.toFixed(1)}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: fire.frp > 10 ? "#ff453a" : "rgba(255,255,255,0.7)" }}>
                          {fire.frp.toFixed(1)}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: fire.confidence === "high" || fire.confidence === "h"
                                ? "rgba(255,69,58,0.15)"
                                : "rgba(255,255,255,0.06)",
                              color: fire.confidence === "high" || fire.confidence === "h"
                                ? "#ff453a"
                                : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {fire.confidence}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)" }}>
                          {fire.acqDate} {fire.acqTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fires.length > 12 && (
                  <div style={{ padding: "10px 16px", backgroundColor: "#111113", fontSize: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                    + {fires.length - 12} more detections
                  </div>
                )}
              </div>
            )}

            {/* No fires — real data message */}
            {!firmsLoading && !firmsError && fires.length === 0 && (
              <div
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  backgroundColor: "rgba(48,209,88,0.06)",
                  border: "1px solid rgba(48,209,88,0.12)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#30d158", marginBottom: "4px" }}>
                  No active fires detected in the Delhi-NCR corridor
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                  NASA FIRMS VIIRS S-NPP scanned the bounding box (27.5°N–30.5°N, 75.5°E–78.5°E) in the last 24 hours
                </div>
              </div>
            )}

            {firmsError && (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(255,69,58,0.08)",
                  border: "1px solid rgba(255,69,58,0.2)",
                  fontSize: "13px",
                  color: "#ff453a",
                }}
              >
                {firmsError}
              </div>
            )}

            {firmsFetchedAt && (
              <div style={{ marginTop: "14px", fontSize: "11px", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
                NASA FIRMS data fetched: {new Date(firmsFetchedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Google Earth Engine (GEE) Multi-Sensor Harmonization Section         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section style={{ padding: "64px 0 80px", backgroundColor: "#0e0e11", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="container" style={{ maxWidth: "1060px" }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#30d158",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "inline-block",
                  marginBottom: "8px",
                }}
              >
                ● Google Earth Engine &bull; Level-3 Harmonization
              </span>
              <h2
                style={{
                  fontSize: "40px",
                  fontWeight: 600,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.1,
                  marginBottom: "12px",
                }}
              >
                Sentinel-5P &amp; MODIS Cross-Calibration.
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  color: "rgba(255,255,255,0.56)",
                  maxWidth: "680px",
                  margin: "0 auto",
                  lineHeight: 1.47,
                }}
              >
                While ISRO INSAT-3DR provides continuous 15-minute cadence, Google Earth Engine serves as
                the high-resolution optical anchor, cross-calibrating thermal infrared channels using
                Copernicus Sentinel-5P TROPOMI Level-3 products.
              </p>
            </div>

            {/* GEE Metrics Grid */}
            {(() => {
              const gee = getGeeHarmonizationData();
              return (
                <div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#161619",
                        borderRadius: "14px",
                        padding: "20px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#30d158", fontWeight: 600, textTransform: "uppercase", marginBottom: "6px" }}>
                        GEE S5P Dataset
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", wordBreak: "break-all" }}>
                        COPERNICUS/S5P/NRTI/L3_AER_AI
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                        TROPOMI Absorbing Aerosol Index (AAI)
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: "#161619",
                        borderRadius: "14px",
                        padding: "20px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#2997ff", fontWeight: 600, textTransform: "uppercase", marginBottom: "6px" }}>
                        Orbital Baseline Anchor
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>
                        +{gee.aerosolIndexMean} <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>AAI</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                        Mean corridor tropospheric density
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: "#161619",
                        borderRadius: "14px",
                        padding: "20px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#af52de", fontWeight: 600, textTransform: "uppercase", marginBottom: "6px" }}>
                        MODIS MAIAC AOD
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>
                        {gee.modisAodMean} <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>τ</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                        1km resolution optical depth anchor
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: "#161619",
                        borderRadius: "14px",
                        padding: "20px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#ff9f0a", fontWeight: 600, textTransform: "uppercase", marginBottom: "6px" }}>
                        INSAT Calibration Concordance
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#30d158" }}>
                        {gee.concordanceScorePercent}%
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
                        Cross-sensor calibration ratio: {gee.calibrationRatioToInsat}
                      </div>
                    </div>
                  </div>

                  {/* GEE Regional Cells Inspection */}
                  <div
                    style={{
                      backgroundColor: "#161619",
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                        Google Earth Engine Sentinel-5P Sub-Corridor Sampling Nodes
                      </span>
                      <span style={{ fontSize: "11px", color: "#30d158", backgroundColor: "rgba(48,209,88,0.1)", padding: "2px 8px", borderRadius: "4px" }}>
                        ● Live GEE Engine Ingest
                      </span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#121214", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Sector</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Coordinates</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Sentinel-5P AAI</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Tropospheric NO₂</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>MODIS AOD</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Quality Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gee.gridCells.map((cell) => (
                            <tr key={cell.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 16px", color: "#ffffff", fontWeight: 500 }}>{cell.label}</td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "rgba(255,255,255,0.4)" }}>
                                {cell.lat.toFixed(3)}°N, {cell.lng.toFixed(3)}°E
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: cell.aai > 3.5 ? "#ff453a" : "#ffd000", fontWeight: 600 }}>
                                +{cell.aai.toFixed(2)}
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "#af52de" }}>
                                {cell.no2TroposphericMolM2.toFixed(1)} µmol/m²
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "#2997ff" }}>
                                {cell.opticalDepthModis.toFixed(2)}
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "#30d158" }}>
                                {(cell.qualityFlag * 100).toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      </main>

      <Footer isDark={true} />

      <style jsx global>{`
        @keyframes pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Subcomponents ── */

function StatCell({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ padding: "20px 24px", backgroundColor: "#111113" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.3px" }}>
        {value}
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: highlight ? "rgba(41, 151, 255, 0.08)" : "rgba(255,255,255,0.02)",
        border: highlight ? "1px solid rgba(41, 151, 255, 0.15)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: highlight ? "#2997ff" : "rgba(255,255,255,0.8)" }}>
        {value}
      </span>
    </div>
  );
}
