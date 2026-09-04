"use client";

import { useEffect, useRef, useState } from "react";
import type { CorridorStation } from "@/types/corridor";

// Lazy-load Leaflet only on client
let L: typeof import("leaflet") | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// SATELLITE BASEMAP
// ═══════════════════════════════════════════════════════════════════════════════

const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_MAX_ZOOM = 18;

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS COLOR (CPCB standard)
// ═══════════════════════════════════════════════════════════════════════════════

function statusColor(status: CorridorStation["status"]): string {
  switch (status) {
    case "Good":
      return "#00b050";
    case "Satisfactory":
      return "#92d050";
    case "Moderate":
      return "#ffd000";
    case "Poor":
      return "#ff8c00";
    case "Very Poor":
      return "#eb1e1e";
    case "Severe":
      return "#7e0023";
    default:
      return "#0066cc";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRIDOR MAP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CorridorMapProps {
  stations: CorridorStation[];
  selectedStation: CorridorStation | null;
  onSelectStation: (station: CorridorStation | null) => void;
  wind?: { speed: number; deg: number; dir: string } | null;
  isLive?: boolean;
}

export default function CorridorMap({
  stations,
  selectedStation,
  onSelectStation,
}: CorridorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);

  // States
  const [mapReady, setMapReady] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<CorridorStation | null>(null);

  const activeStation = hoveredStation || selectedStation;

  // ─── 1. Initialize Leaflet Map with Satellite Imagery ─────────────────────
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (!L) {
        L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
      }

      if (isCancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number | null };
      if (container._leaflet_id) {
        container._leaflet_id = null;
      }

      const delhiBounds = L.latLngBounds(
        [28.30, 76.84],
        [28.90, 77.60]
      );

      const map = L.map(container, {
        center: [28.6139, 77.209],
        zoom: 10,
        minZoom: 10,
        maxZoom: 16,
        maxBounds: delhiBounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        attributionControl: false,
      });

      map.fitBounds(delhiBounds, { padding: [16, 16] });

      if (isCancelled) {
        map.remove();
        return;
      }

      L.tileLayer(SATELLITE_TILE_URL, {
        maxZoom: SATELLITE_MAX_ZOOM,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // ─── 2. Station Markers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stations.forEach((station) => {
      const isSelected = selectedStation?.id === station.id;
      const color = statusColor(station.status);
      const isSevere = station.aqi > 200;

      const customHtml = `
        <div class="tropos-station-marker dark-mode ${isSelected ? "selected" : ""}" id="marker-${station.id}">
          <div class="tropos-marker-badge">
            <span class="tropos-marker-dot" style="background-color: ${color}; color: ${color};">
              ${isSevere || isSelected ? '<span class="tropos-marker-pulse"></span>' : ""}
            </span>
            <span>${station.aqi}</span>
          </div>
          <div class="tropos-marker-title">${station.name}</div>
        </div>
      `;

      const icon = leaflet.divIcon({
        html: customHtml,
        className: "tropos-custom-pin",
        iconSize: [64, 44],
        iconAnchor: [32, 22],
      });

      const marker = leaflet.marker([station.lat, station.lng], { icon }).addTo(map);

      marker.on("click", (e) => {
        leaflet.DomEvent.stopPropagation(e);
        onSelectStation(selectedStation?.id === station.id ? null : station);
      });
      marker.on("mouseover", () => setHoveredStation(station));
      marker.on("mouseout", () =>
        setHoveredStation((c) => (c?.id === station.id ? null : c))
      );

      markersRef.current.push(marker);
    });

    const onMapClick = () => onSelectStation(null);
    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
    };
  }, [stations, selectedStation, mapReady, onSelectStation]);

  // ─── 3. Pan to selected station ───────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStation) return;
    mapInstanceRef.current.flyTo([selectedStation.lat, selectedStation.lng], 12, { duration: 0.6 });
  }, [selectedStation]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: "#0d0d0f",
        position: "relative",
      }}
    >
      {/* 1. Leaflet Map */}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      />

      {/* ── BOTTOM-CENTER: Quick Station Card ── */}
      {activeStation && (
        <div
          className="corridor-floating-card"
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: statusColor(activeStation.status) }} />
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{activeStation.name}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#8e8e93", marginTop: "2px" }}>
              {activeStation.status} · {activeStation.source === "google" ? "CPCB" : "CAMS"}
            </div>
          </div>

          <div style={{ width: "1px", height: "26px", backgroundColor: "rgba(255,255,255,0.15)" }} />

          <div>
            <div style={{ fontSize: "14px", fontWeight: 700 }}>AQI {activeStation.aqi}</div>
            <div style={{ fontSize: "11px", color: "#8e8e93" }}>{activeStation.pm25} µg/m³</div>
          </div>

          <div style={{ width: "1px", height: "26px", backgroundColor: "rgba(255,255,255,0.15)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "11px", color: "#8e8e93" }}>Ceiling: {activeStation.boundaryLayerHeight}m</span>
          </div>
        </div>
      )}
    </div>
  );
}
