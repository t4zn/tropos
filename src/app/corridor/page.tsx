"use client";

import { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCorridorData } from "@/hooks/useCorridorData";
import type { CorridorStation } from "@/types/corridor";
import { getGeeOrbitalAnchorForCoordinate } from "@/lib/earthEngine";

// Dynamic import to avoid SSR issues with Leaflet
const CorridorMap = dynamic(() => import("@/components/CorridorMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
        backgroundColor: "#f5f5f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#7a7a7a",
        fontSize: "14px",
        fontWeight: 400,
      }}
    >
      Loading map…
    </div>
  ),
});

function statusColor(status: CorridorStation["status"]): string {
  switch (status) {
    case "Good":
      return "#34c759";
    case "Satisfactory":
      return "#30d158";
    case "Moderate":
      return "#ff9f0a";
    case "Poor":
      return "#ff6b35";
    case "Very Poor":
      return "#ff453a";
    case "Severe":
      return "#ff2d55";
    default:
      return "#8e8e93";
  }
}

export default function CorridorPage() {
  const { stations, wind, isLoading, error, lastUpdated, refetch } = useCorridorData();
  const [selectedStation, setSelectedStation] = useState<CorridorStation | null>(null);
  const [geeLayer, setGeeLayer] = useState<"none" | "s5p-aai" | "s5p-no2">("none");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd+K, Ctrl+K, or "/" to focus search bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
      if (e.key === "Escape") {
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter stations based on search query & region chip
  const filteredStations = stations.filter((station) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      station.name.toLowerCase().includes(q) ||
      (station.area && station.area.toLowerCase().includes(q)) ||
      (station.provider && station.provider.toLowerCase().includes(q)) ||
      station.status.toLowerCase().includes(q);

    const matchesRegion =
      selectedRegion === "All" ||
      (selectedRegion === "Delhi" &&
        (station.area?.toLowerCase().includes("delhi") ||
          station.name.toLowerCase().includes("delhi") ||
          station.id.startsWith("DEL-"))) ||
      (selectedRegion === "Noida" &&
        (station.area?.toLowerCase().includes("noida") ||
          station.id.startsWith("UP-NOI") ||
          station.id.startsWith("UP-GBN"))) ||
      (selectedRegion === "Gurugram" &&
        (station.area?.toLowerCase().includes("gurugram") ||
          station.id.startsWith("HAR-GGN"))) ||
      (selectedRegion === "Faridabad" &&
        (station.area?.toLowerCase().includes("faridabad") ||
          station.id.startsWith("HAR-FBD"))) ||
      (selectedRegion === "Ghaziabad" &&
        (station.area?.toLowerCase().includes("ghaziabad") ||
          station.id.startsWith("UP-GZB")));

    return matchesQuery && matchesRegion;
  });

  // Corridor summary
  const avgAqi = stations.length
    ? Math.round(stations.reduce((sum, s) => sum + s.aqi, 0) / stations.length)
    : 0;
  const maxAqi = stations.length ? Math.max(...stations.map((s) => s.aqi)) : 0;
  const severeCount = stations.filter((s) => s.aqi > 300).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      <Navigation />

      <main style={{ flex: 1 }}>
        {/* Header */}
        {/* Header */}
        <section className="corridor-hero-section">
          <div className="container">
            <span className="corridor-eyebrow">
              Live Corridor
            </span>

            <h1 className="corridor-title">
              Air-Shed Map.
            </h1>

            <p className="corridor-subtitle">
              Live real-time air quality telemetry across the Delhi-NCR airshed.
            </p>
          </div>
        </section>

        {/* Status bar */}
        <section className="corridor-stats-section">
          <div className="container corridor-stats-container">
            <div style={{ textAlign: "center" }}>
              <div className="corridor-stat-value">
                {isLoading ? "—" : avgAqi}
              </div>
              <div className="corridor-stat-label">
                Avg AQI
              </div>
            </div>

            <div style={{ width: "1px", backgroundColor: "#e5e5e5", alignSelf: "stretch" }} />

            <div style={{ textAlign: "center" }}>
              <div
                className="corridor-stat-value"
                style={{ color: maxAqi > 300 ? "#ff453a" : undefined }}
              >
                {isLoading ? "—" : maxAqi}
              </div>
              <div className="corridor-stat-label">
                Peak AQI
              </div>
            </div>

            <div style={{ width: "1px", backgroundColor: "#e5e5e5", alignSelf: "stretch" }} />

            <div style={{ textAlign: "center" }}>
              <div className="corridor-stat-value">
                {isLoading ? "—" : stations.length}
              </div>
              <div className="corridor-stat-label">
                Stations
              </div>
            </div>

            <div style={{ width: "1px", backgroundColor: "#e5e5e5", alignSelf: "stretch" }} />

            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#16a34a" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#16a34a",
                    animation: "pulse-live 2s infinite",
                  }}
                />
                Live Network
              </div>
              <div className="corridor-stat-label">
                Real-Time Telemetry
              </div>
            </div>

            {severeCount > 0 && (
              <>
                <div style={{ width: "1px", backgroundColor: "#e5e5e5", alignSelf: "stretch" }} />
                <div style={{ textAlign: "center" }}>
                  <div
                    className="corridor-stat-value"
                    style={{ color: "#ff453a" }}
                  >
                    {severeCount}
                  </div>
                  <div className="corridor-stat-label">
                    Severe
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Search & Location Filter Toolbar */}
        <section className="corridor-search-section">
          <div className="container corridor-search-container">
            <div className="corridor-search-wrapper">
              {/* Search Box */}
              <div className="corridor-search-input-box">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8e8e93"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>

                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search locations, stations, or areas (e.g. Anand Vihar, Noida, IGI, Gurugram)..."
                  className="corridor-search-input"
                />

                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchFocused(false);
                    }}
                    className="corridor-search-clear"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}

                <span className="corridor-search-shortcut" title="Press ⌘K or / to search">
                  ⌘K
                </span>
              </div>

              {/* Quick Region Chips */}
              <div className="corridor-chips-list">
                {["All", "Delhi", "Noida", "Gurugram", "Faridabad", "Ghaziabad"].map((region) => (
                  <button
                    key={region}
                    onClick={() => {
                      setSelectedRegion(region);
                      setIsSearchFocused(false);
                    }}
                    className={`corridor-chip ${selectedRegion === region ? "active" : ""}`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* Instant Autocomplete Dropdown */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="corridor-search-dropdown" ref={dropdownRef}>
                {filteredStations.length === 0 ? (
                  <div className="corridor-search-empty">
                    No stations match "{searchQuery}"
                  </div>
                ) : (
                  filteredStations.slice(0, 8).map((station) => (
                    <div
                      key={station.id}
                      onClick={() => {
                        setSelectedStation(station);
                        setIsSearchFocused(false);
                      }}
                      className="corridor-search-dropdown-item"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: statusColor(station.status),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600, color: "#1d1d1f", fontSize: "14px" }}>
                          {station.name}
                        </span>
                        {station.area && (
                          <span style={{ color: "#8e8e93", fontSize: "12px" }}>
                            • {station.area}
                          </span>
                        )}
                        {station.provider && (
                          <span className="corridor-provider-pill">
                            {station.provider}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", color: "#8e8e93" }}>
                          PM2.5: {station.pm25}
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: statusColor(station.status),
                            minWidth: "36px",
                            textAlign: "right",
                          }}
                        >
                          AQI {station.aqi}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {/* Map + Inspector */}
        <section className="corridor-map-section">
          <div className={`container corridor-map-grid ${selectedStation ? "has-selected" : ""}`}>
            {/* Map Card */}
            <div className="corridor-map-card">
              {error && !isLoading ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: "#7a7a7a",
                    fontSize: "14px",
                  }}
                >
                  <p>Unable to load live data.</p>
                  <button
                    onClick={refetch}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "9999px",
                      border: "none",
                      backgroundColor: "#0066cc",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <CorridorMap
                  stations={filteredStations.length > 0 ? filteredStations : stations}
                  selectedStation={selectedStation}
                  onSelectStation={setSelectedStation}
                  wind={wind}
                  isLive={!error}
                  geeLayer={geeLayer}
                  onGeeLayerChange={setGeeLayer}
                />
              )}
            </div>

            {/* Station Inspector Card */}
            {selectedStation && (
              <div className="corridor-inspector-card">
                {/* Close button */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#0066cc", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Station
                      </span>
                      {selectedStation.provider && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "#0066cc",
                            backgroundColor: "#f0f7ff",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            border: "0.5px solid #d0e5ff",
                          }}
                        >
                          {selectedStation.provider}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.3px", lineHeight: 1.15 }}>
                      {selectedStation.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedStation(null)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "#f5f5f7",
                      color: "#7a7a7a",
                      fontSize: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* AQI Badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "12px",
                    marginBottom: "20px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "48px",
                      fontWeight: 600,
                      color: statusColor(selectedStation.status),
                      letterSpacing: "-1px",
                      lineHeight: 1,
                    }}
                  >
                    {selectedStation.aqi}
                  </span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#1d1d1f" }}>
                      {selectedStation.status}
                    </div>
                    <div style={{ fontSize: "12px", color: "#7a7a7a", marginTop: "1px" }}>
                      India CPCB NAQI
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1 }}>
                  <MetricCell label="PM2.5" value={`${selectedStation.pm25}`} unit="µg/m³" />
                  <MetricCell
                    label="PM10"
                    value={selectedStation.pm10 > 0 ? `${selectedStation.pm10}` : "—"}
                    unit={selectedStation.pm10 > 0 ? "µg/m³" : "unmeasured"}
                  />
                  <MetricCell label="Wind" value={`${selectedStation.windSpeed}`} unit={`km/h ${selectedStation.windDir}`} />
                  <MetricCell label="Boundary Layer" value={`${selectedStation.boundaryLayerHeight}`} unit="m" />
                  <MetricCell label="Temperature" value={`${selectedStation.temperature}`} unit="°C" />
                  <MetricCell label="Humidity" value={`${selectedStation.humidity}`} unit="%" />
                </div>

                {/* Google Earth Engine (GEE) Orbital Anchor */}
                {(() => {
                  const gee = getGeeOrbitalAnchorForCoordinate(selectedStation.lat, selectedStation.lng);
                  return (
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#2563eb", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          Google Earth Engine Anchor
                        </span>
                        <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>● S5P TROPOMI L3</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#1e293b", fontWeight: 500 }}>
                        <span>Orbital AOD: <b>{gee.orbitalAod.toFixed(2)}</b></span>
                        <span>Aerosol Index: <b>+{gee.aai.toFixed(2)}</b></span>
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                        Calibrated at {gee.distanceKm}km ({gee.nearestCellLabel})
                      </div>
                    </div>
                  );
                })()}

                {/* Observation time */}
                {selectedStation.observationTime && (
                  <div style={{ fontSize: "11px", color: "#6e6e73", marginTop: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#16a34a" }} />
                    Telemetry observed: {new Date(selectedStation.observationTime).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}

                {/* Source + Trace CTA */}
                <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: "11px", color: "#7a7a7a", marginBottom: "12px" }}>
                    Source: {selectedStation.source === "openweather"
                      ? `OpenWeather Live (${selectedStation.provider || "Station Sensor"})`
                      : selectedStation.source === "openaq"
                      ? `OpenAQ v3 (${selectedStation.provider || "Ground Telemetry"})`
                      : selectedStation.source === "google"
                      ? "Google Air Quality API"
                      : "Real-Time Telemetry"}
                  </div>
                  <Link
                    href={`/attribution?station=${selectedStation.id}`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "10px 0",
                      borderRadius: "9999px",
                      backgroundColor: "#0066cc",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 500,
                      textDecoration: "none",
                      letterSpacing: "-0.1px",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    Trace Source →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Station Cards Grid */}
        <section className="corridor-stations-section">
          <div className="container" style={{ maxWidth: "1120px" }}>
            <div className="corridor-stations-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h2 className="corridor-stations-title">
                  All Stations
                </h2>
                {(searchQuery.trim() || selectedRegion !== "All") && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#0066cc",
                        backgroundColor: "#f0f7ff",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: 500,
                        border: "0.5px solid #d0e5ff",
                      }}
                    >
                      Filtered: {filteredStations.length} of {stations.length}
                    </span>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedRegion("All");
                      }}
                      style={{
                        fontSize: "12px",
                        color: "#6e6e73",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {lastUpdated && (
                <span className="corridor-stations-time">
                  Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="corridor-loading-state">
                Fetching real-time telemetry for Delhi-NCR stations…
              </div>
            ) : filteredStations.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  backgroundColor: "#f5f5f7",
                  borderRadius: "14px",
                  color: "#8e8e93",
                  fontSize: "14px",
                }}
              >
                No stations match "{searchQuery || selectedRegion}".
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRegion("All");
                  }}
                  style={{
                    display: "block",
                    margin: "12px auto 0",
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    backgroundColor: "#0066cc",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="corridor-table-card">
                <table className="corridor-table">
                  <colgroup>
                    <col className="col-station" />
                    <col className="col-aqi" />
                    <col className="col-pm25" />
                    <col className="col-wind" />
                  </colgroup>
                  <thead>
                    <tr className="corridor-table-header">
                      <th className="corridor-th" style={{ textAlign: "left" }}>
                        Station
                      </th>
                      <th className="corridor-th" style={{ textAlign: "right" }}>
                        AQI
                      </th>
                      <th className="corridor-th" style={{ textAlign: "right" }}>
                        PM2.5
                      </th>
                      <th className="corridor-th" style={{ textAlign: "right" }}>
                        Wind
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStations.map((station) => {
                      const isSelected = selectedStation?.id === station.id;
                      return (
                        <tr
                          key={station.id}
                          onClick={() => setSelectedStation(station)}
                          className={`corridor-table-row ${isSelected ? "is-selected" : ""}`}
                        >
                          <td className="corridor-td">
                            <div className="corridor-station-row-inner">
                              <span
                                className="corridor-station-dot"
                                style={{
                                  backgroundColor: statusColor(station.status),
                                }}
                              />
                              <span className="corridor-station-name">
                                {station.name}
                              </span>
                              {station.area && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "#8e8e93",
                                    marginLeft: "6px",
                                  }}
                                >
                                  ({station.area})
                                </span>
                              )}
                              {station.provider && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: "#0066cc",
                                    backgroundColor: "#f0f7ff",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    marginLeft: "8px",
                                    border: "0.5px solid #d0e5ff",
                                    letterSpacing: "0.2px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {station.provider}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="corridor-td corridor-aqi-cell"
                            style={{ textAlign: "right" }}
                          >
                            {station.aqi}
                          </td>
                          <td
                            className="corridor-td corridor-pm25-cell"
                            style={{ textAlign: "right" }}
                          >
                            {station.pm25} µg/m³
                          </td>
                          <td
                            className="corridor-td corridor-wind-cell"
                            style={{ textAlign: "right" }}
                          >
                            {station.windSpeed} km/h {station.windDir}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        @keyframes pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .leaflet-container {
          background: #f5f5f7 !important;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
        }

        .tropos-tooltip {
          background: rgba(255, 255, 255, 0.96) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
          padding: 8px 12px !important;
        }

        .tropos-tooltip::before {
          display: none !important;
        }

        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
          border-radius: 10px !important;
          overflow: hidden !important;
        }

        .leaflet-control-zoom a {
          background: rgba(255, 255, 255, 0.95) !important;
          color: #1d1d1f !important;
          border: none !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 16px !important;
          font-weight: 300 !important;
        }

        .leaflet-control-zoom a:hover {
          background: #f5f5f7 !important;
        }

        .leaflet-control-zoom-in {
          border-bottom: 1px solid #f0f0f0 !important;
        }

        /* Mobile responsive for map + inspector */
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function MetricCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#7a7a7a", fontWeight: 500, marginBottom: "3px", letterSpacing: "0.1px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span style={{ fontSize: "18px", fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.2px" }}>
          {value}
        </span>
        <span style={{ fontSize: "11px", color: "#7a7a7a" }}>{unit}</span>
      </div>
    </div>
  );
}
