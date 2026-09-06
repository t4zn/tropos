"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCorridorData } from "@/hooks/useCorridorData";
import type { CorridorStation } from "@/types/corridor";

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
              Real-time air quality across the Delhi-NCR corridor.
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
                  stations={stations}
                  selectedStation={selectedStation}
                  onSelectStation={setSelectedStation}
                  wind={wind}
                  isLive={!error}
                />
              )}
            </div>

            {/* Station Inspector Card */}
            {selectedStation && (
              <div className="corridor-inspector-card">
                {/* Close button */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#0066cc", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                      Station
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
                    marginBottom: "24px",
                    paddingBottom: "20px",
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
                      India CPCB AQI
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1 }}>
                  <MetricCell label="PM2.5" value={`${selectedStation.pm25}`} unit="µg/m³" />
                  <MetricCell label="PM10" value={`${selectedStation.pm10}`} unit="µg/m³" />
                  <MetricCell label="Wind" value={`${selectedStation.windSpeed}`} unit={`km/h ${selectedStation.windDir}`} />
                  <MetricCell label="Boundary Layer" value={`${selectedStation.boundaryLayerHeight}`} unit="m" />
                  <MetricCell label="Temperature" value={`${selectedStation.temperature}`} unit="°C" />
                  <MetricCell label="Humidity" value={`${selectedStation.humidity}`} unit="%" />
                </div>

                {/* Source + Trace CTA */}
                <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: "11px", color: "#7a7a7a", marginBottom: "12px" }}>
                    Source: {selectedStation.source === "google" ? "Google Air Quality API" : "Open-Meteo CAMS"}
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
              <h2 className="corridor-stations-title">
                All Stations
              </h2>
              {lastUpdated && (
                <span className="corridor-stations-time">
                  Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="corridor-loading-state">
                Fetching live data from Open-Meteo…
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
                    {stations.map((station) => {
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
