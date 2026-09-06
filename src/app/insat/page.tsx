"use client";

import { useState, useEffect, useCallback } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSatelliteData } from "@/hooks/useSatelliteData";
import { useFirmsData } from "@/hooks/useFirmsData";
import dynamic from "next/dynamic";

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

  // Reset image loaded state on selection change
  useEffect(() => {
    setImageLoaded(false);
  }, [selectedScanIdx, selectedChannel]);

  const currentScan = scans[selectedScanIdx] ?? null;
  const currentImageUrl = currentScan?.channels?.[selectedChannel] ?? null;
  const currentKey = currentScan ? `${currentScan.dateLabel}-${currentScan.utcTime}-${selectedChannel}` : "";
  const currentFailed = failedScans.has(currentKey);

  // When an image fails, auto-advance to the next scan slot
  function handleImageError() {
    setFailedScans((prev) => new Set(prev).add(currentKey));
    // Try next scan slot automatically
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
        <section style={{ padding: "120px 0 48px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
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
                marginBottom: "20px",
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
                fontSize: "56px",
                fontWeight: 600,
                letterSpacing: "-0.5px",
                lineHeight: 1.07,
                marginBottom: "16px",
              }}
            >
              INSAT-3DS.
            </h1>

            <p
              style={{
                fontSize: "21px",
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

        {/* Live Atmospheric Stats Bar */}
        <section style={{ padding: "0 0 40px", backgroundColor: "#0a0a0a" }}>
          <div className="container" style={{ maxWidth: "960px" }}>
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
                label="Wind"
                value={wxLoading ? "—" : weather ? `${weather.windSpeed}` : "—"}
                unit={`km/h ${weather?.windDir ?? ""}`}
                color="#2997ff"
              />
              <StatCell
                label="Boundary Layer"
                value={wxLoading ? "—" : weather ? `${weather.boundaryLayerEstimate}` : "—"}
                unit="m"
                color="#2997ff"
              />
              <StatCell
                label="FIRMS Fires"
                value={firmsLoading ? "—" : `${corridorFireCount}`}
                unit="corridor"
                color={corridorFireCount > 0 ? "#ff453a" : "#30d158"}
              />
              <StatCell
                label="Temperature"
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
                        onClick={() => setSelectedAodIdx(idx)}
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
                  <span>Hover to inspect regional aerosol conditions · Click any hotspot marker to fly to sector</span>
                  <span>ISRO MOSDAC Level-2 Geophysical Product · Authenticated CARTO Basemap</span>
                </div>
              </div>
            ) : (
              /* ── View Mode B: Multispectral Full-Disk Channels ── */
              <div>
                {/* Channel Selector */}
                <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "16px" }}>
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

                {/* Scan Timeline */}
                <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {scans.map((scan, idx) => {
                    const scanKey = `${scan.dateLabel}-${scan.utcTime}-${selectedChannel}`;
                    const isFailed = failedScans.has(scanKey);
                    return (
                      <button
                        key={`${scan.dateLabel}-${scan.utcTime}`}
                        onClick={() => setSelectedScanIdx(idx)}
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
                        transition: "opacity 0.4s ease",
                        position: "absolute",
                        inset: 0,
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
                        {currentScan.dateLabel} · {currentScan.utcTime} UTC
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {channelLabels[selectedChannel] ?? selectedChannel}
                      </span>
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
                  <span>Preview imagery for research / education use</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Aerosol Optical Depth — Interactive Map Section                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section style={{ padding: "64px 0 80px", backgroundColor: "#111113" }}>
          <div className="container" style={{ maxWidth: "1060px" }}>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
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
                INSAT-3DS · Level-2 Product
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
                Aerosol Optical Depth.
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  color: "rgba(255,255,255,0.56)",
                  maxWidth: "640px",
                  margin: "0 auto",
                  lineHeight: 1.47,
                }}
              >
                Derived from INSAT-3DS visible-band radiances, the AOD product maps aerosol
                loading across the subcontinent. Hover to explore regional conditions.
              </p>
            </div>

            {/* AOD Time Selector */}
            {aodScans.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "4px",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                }}
              >
                {aodScans.map((aod, idx) => (
                  <button
                    key={`${aod.dateLabel}-${aod.utcTime}`}
                    onClick={() => setSelectedAodIdx(idx)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border:
                        selectedAodIdx === idx
                          ? "1px solid #2997ff"
                          : "1px solid rgba(255,255,255,0.08)",
                      backgroundColor:
                        selectedAodIdx === idx
                          ? "rgba(41, 151, 255, 0.12)"
                          : "transparent",
                      color:
                        selectedAodIdx === idx
                          ? "#2997ff"
                          : "rgba(255,255,255,0.5)",
                      fontSize: "12px",
                      fontWeight: 500,
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
                height: "520px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <AodMap
                imageUrl={currentAod?.url ?? null}
                opacity={0.7}
                timeLabel={currentAod?.istTime}
                dateLabel={currentAod?.dateLabel}
                weather={weather}
                fires={fires}
              />
            </div>

            {/* No AOD available message */}
            {!satLoading && aodScans.length === 0 && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(41,151,255,0.06)",
                  border: "1px solid rgba(41,151,255,0.12)",
                  textAlign: "center",
                  marginTop: "16px",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#2997ff", marginBottom: "4px" }}>
                  AOD data not yet available for today
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                  Aerosol Optical Depth is a daytime product — typically available from 11:00 AM IST onwards
                </div>
              </div>
            )}

            {/* Source attribution */}
            <div
              style={{
                marginTop: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "rgba(255,255,255,0.2)",
              }}
            >
              <span>Source: ISRO MOSDAC · {satellite} L2G AOD V01R00</span>
              <span>Level-2 geophysical product for research / education use</span>
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
