"use client"

import { Suspense, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCorridorData } from "@/hooks/useCorridorData";
import { useWindHistory } from "@/hooks/useWindHistory";
import { computeRealAttribution, type AttributionResult } from "@/lib/attribution";
import type { CorridorStation } from "@/types/corridor";

const CorridorMap = dynamic(() => import("@/components/CorridorMap"), { ssr: false });

function AttributionFallback() {
  return <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />;
}

export default function AttributionPage() {
  return (
    <Suspense fallback={<AttributionFallback />}>
      <AttributionContent />
    </Suspense>
  );
}

function AttributionContent() {
  const searchParams = useSearchParams();
  const stationIdFromUrl = searchParams.get("station");
  const { stations, wind, isLoading, error } = useCorridorData();
  const [lookbackHours, setLookbackHours] = useState(3);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);

  // Default to Anand Vihar (DEL-AV-01) or highest AQI Delhi-NCR station on refresh
  const defaultStation = useMemo(() => {
    if (stations.length === 0) return null;
    const anandVihar = stations.find((s) => s.id === "DEL-AV-01");
    if (anandVihar) return anandVihar;
    const ncrStations = stations.filter(
      (s) => s.id.startsWith("DEL-") || s.id.startsWith("UP-") || s.id.startsWith("HAR-GGN")
    );
    if (ncrStations.length > 0) {
      return ncrStations.reduce((highest, s) => (!highest || s.aqi > highest.aqi ? s : highest), ncrStations[0]);
    }
    return stations[0];
  }, [stations]);

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ??
    stations.find((station) => station.id === stationIdFromUrl) ??
    defaultStation;

  // Real hourly wind history from Open-Meteo for the selected station
  const { windHistory, isLoading: isWindLoading, source: windSource } = useWindHistory(
    selectedStation?.lat ?? null,
    selectedStation?.lng ?? null,
    lookbackHours
  );

  const result: AttributionResult | null = useMemo(() => {
    if (!selectedStation) return null;

    return computeRealAttribution(
      selectedStation.lat,
      selectedStation.lng,
      windHistory,
      selectedStation.windSpeed || wind?.speed || 4.5,
      selectedStation.windDeg || wind?.deg || 295,
      lookbackHours,
      selectedStation.pm25,
      selectedStation.boundaryLayerHeight || 180
    );
  }, [lookbackHours, selectedStation, wind, windHistory]);

  const handleSelectStation = (station: CorridorStation | null) => {
    setSelectedStationId(station?.id ?? null);
    setHighlightedSourceId(null);
  };

  const topCandidates = result?.ranked.slice(0, 5) ?? [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navigation />
      <main style={{ flex: 1 }}>
        <section className="product-tile-light">
          <div className="container">
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Left Column: Controls & Candidate List */}
              <div style={{ flex: "1 1 380px", maxWidth: "520px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "var(--color-primary)", fontSize: 13, fontWeight: 600, letterSpacing: "0.5px" }}>
                    KINEMATIC LAGRANGIAN DISPERSION
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: result?.isKinematic ? "#34c759" : "#ff9500",
                    }}
                  />
                </div>

                <h1 className="hero-display" style={{ fontSize: "36px", marginBottom: "8px" }}>
                  Source Attribution
                </h1>

                <p className="lead" style={{ color: "var(--color-ink-muted-48)", fontSize: "17px", lineHeight: 1.4, marginBottom: "16px" }}>
                  Backward particle advection intersecting real OpenStreetMap industrial polygons with hourly wind observations.
                </p>

                {/* Data Engine Badges */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(0, 102, 204, 0.08)",
                      color: "#0066cc",
                      border: "1px solid rgba(0, 102, 204, 0.15)",
                    }}
                  >
                    {isWindLoading ? "Loading Wind History..." : `Wind: ${windSource || "Open-Meteo ERA5/GFS"}`}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(52, 199, 89, 0.08)",
                      color: "#248a3d",
                      border: "1px solid rgba(52, 199, 89, 0.2)",
                    }}
                  >
                    OSM Industrial Registry ({result?.sourceCount ?? 40}+ estates)
                  </span>
                </div>

                {error && !isLoading ? (
                  <div role="alert" className="store-utility-card" style={{ marginTop: 18 }}>
                    Live corridor data is unavailable. Attribution is paused until a current observation can be loaded.
                  </div>
                ) : (
                  <>
                    {/* Receptor Station Selection */}
                    <div style={{ marginBottom: 16 }}>
                      <label htmlFor="station-selector" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Receptor Station:
                      </label>
                      <select
                        id="station-selector"
                        value={selectedStation?.id || ""}
                        onChange={(e) => {
                          setSelectedStationId(e.target.value);
                          setHighlightedSourceId(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #d2d2d7",
                          backgroundColor: "#f5f5f7",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.area || s.provider}) — AQI {s.aqi}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Lookback Slider */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="lookback-hours" style={{ fontSize: 13, fontWeight: 600 }}>
                          Lookback Window:
                        </label>
                        <span style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 600 }}>
                          {lookbackHours} hours ({lookbackHours * 60} mins)
                        </span>
                      </div>
                      <input
                        id="lookback-hours"
                        type="range"
                        min={1}
                        max={6}
                        step={1}
                        value={lookbackHours}
                        onChange={(event) => setLookbackHours(Number(event.target.value))}
                        style={{ width: "100%", accentColor: "var(--color-primary)" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8e8e93", marginTop: 2 }}>
                        <span>1h (Local micro-spill)</span>
                        <span>3h (Sub-regional)</span>
                        <span>6h (Corridor scale)</span>
                      </div>
                    </div>

                    {/* Active Receptor Summary Card */}
                    <div
                      style={{
                        padding: "12px 16px",
                        backgroundColor: "#f5f5f7",
                        borderRadius: 10,
                        border: "1px solid #e5e5ea",
                        marginBottom: 16,
                      }}
                    >
                      {isLoading ? (
                        <div style={{ fontSize: 13, color: "#8e8e93" }}>Loading live receptor observation…</div>
                      ) : selectedStation ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedStation.name}</div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                backgroundColor: selectedStation.aqi > 300 ? "#ff2d55" : selectedStation.aqi > 200 ? "#ff453a" : "#ff9f0a",
                                color: "#ffffff",
                              }}
                            >
                              AQI {selectedStation.aqi}
                            </span>
                          </div>
                          <div style={{ color: "#7a7a7a", fontSize: 12, marginTop: 4 }}>
                            PM2.5: {selectedStation.pm25} µg/m³ · Wind: {selectedStation.windSpeed || wind?.speed} km/h {selectedStation.windDir || wind?.dir} ({selectedStation.windDeg || wind?.deg}°) · BLH: {selectedStation.boundaryLayerHeight}m
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: "#8e8e93" }}>No live station available.</div>
                      )}
                    </div>

                    {/* Candidate Source Ranking List */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#0066cc", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          Upwind Candidates ({topCandidates.length} identified)
                        </span>
                        <span style={{ fontSize: 11, color: "#8e8e93" }}>Click to highlight on map</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {topCandidates.map((cand, idx) => {
                          const isSelected = highlightedSourceId === cand.id || (highlightedSourceId === null && idx === 0);
                          return (
                            <div
                              key={cand.id}
                              onClick={() => setHighlightedSourceId(cand.id)}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 10,
                                border: isSelected ? "2px solid #0066cc" : "1px solid #e5e5ea",
                                backgroundColor: isSelected ? "rgba(0, 102, 204, 0.03)" : "#ffffff",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: isSelected ? "#0066cc" : "#8e8e93",
                                      }}
                                    >
                                      #{idx + 1}
                                    </span>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{cand.name}</h4>
                                  </div>
                                  {cand.typeLabel && (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        fontSize: 11,
                                        color: "#5856d6",
                                        backgroundColor: "rgba(88, 86, 214, 0.08)",
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        marginTop: 4,
                                      }}
                                    >
                                      {cand.typeLabel}
                                    </span>
                                  )}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: cand.score > 0.6 ? "#ff453a" : cand.score > 0.4 ? "#ff9500" : "#34c759",
                                    }}
                                  >
                                    {Math.round(cand.score * 100)}%
                                  </span>
                                  <div style={{ fontSize: 11, color: "#8e8e93" }}>model score</div>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#7a7a7a", marginTop: 6 }}>
                                <span>{cand.distanceKm} km {cand.bearingDeg}°</span>
                                {cand.area && <span>· {cand.area} ({cand.state})</span>}
                              </div>

                              {isSelected && cand.reasons.length > 0 && (
                                <ul style={{ fontSize: 12, color: "#48484a", marginTop: 8, paddingLeft: 18, lineHeight: 1.4 }}>
                                  {cand.reasons.map((r) => (
                                    <li key={r}>{r}</li>
                                  ))}
                                </ul>
                              )}

                              {isSelected && cand.osmSource && (
                                <div style={{ fontSize: 10, color: "#8e8e93", marginTop: 6 }}>
                                  Source: {cand.osmSource}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.4, marginTop: 12 }}>
                      Disclaimer: This attribution score is an advisory screening metric based on atmospheric backward transport and OpenStreetMap industrial land-use registries. It is not legal proof of individual stack compliance.
                    </p>
                  </>
                )}
              </div>

              {/* Right Column: Full Interactive Map */}
              <div style={{ flex: "1 1 450px", minHeight: "580px", height: "640px", position: "sticky", top: 76 }}>
                <CorridorMap
                  stations={stations}
                  selectedStation={selectedStation ?? null}
                  onSelectStation={handleSelectStation}
                  particlePaths={result?.particlePaths}
                  envelope={result?.envelope}
                  candidates={topCandidates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    lat: c.lat,
                    lng: c.lng,
                  }))}
                  highlightedSourceId={highlightedSourceId || topCandidates[0]?.id || null}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

