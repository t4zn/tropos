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
  // Optional overlays for attribution visualization
  particlePaths?: Array<Array<{ lat: number; lng: number }>>;
  envelope?: Array<{ lat: number; lng: number }>;
  candidates?: Array<{ id: string; lat: number; lng: number; name: string }>;
  highlightedSourceId?: string | null;
  onMapReady?: (map: import("leaflet").Map) => void;
}

export default function CorridorMap({
  stations,
  selectedStation,
  onSelectStation,
  wind,
  isLive,
  particlePaths,
  envelope,
  candidates,
  highlightedSourceId,
  onMapReady,
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

      // debug: log station being rendered
      try { console.log('[CorridorMap] addMarker', station.id, station.name, station.lat, station.lng, 'AQI', station.aqi); } catch(e){}

      const customHtml = `
        <div class="tropos-station-marker dark-mode ${isSelected ? "selected" : ""}" id="marker-${station.id}">
          <div class="tropos-marker-badge">
            <span class="tropos-marker-dot" style="background-color: ${color}; color: ${color};">
              ${isSevere || isSelected ? '<span class="tropos-marker-pulse"></span>' : ""}
            </span>
            <span>${station.aqi}</span>
          </div>
        </div>
      `;

      const icon = leaflet.divIcon({
        html: customHtml,
        className: "tropos-custom-pin",
        iconSize: [48, 24],
        iconAnchor: [24, 12],
      });

      const marker = leaflet.marker([station.lat, station.lng], { icon }).addTo(map);

      marker.bindTooltip(station.name, {
        direction: "top",
        offset: [0, -14],
        className: "tropos-tooltip",
      });

      marker.on("click", (e) => {
        leaflet.DomEvent.stopPropagation(e);
        try { console.log('[CorridorMap] marker.click', station.id, station.name); } catch(e){}
        // toggle selection
        if (selectedStation?.id === station.id) onSelectStation(null);
        else onSelectStation(station);
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

  // ─── 4. Render attribution overlays (particles, envelope, candidates)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    // Clear previous overlay layers stored on map instance
    const existingLayers = (map as any)._troposOverlayLayers as import("leaflet").Layer[] | undefined;
    if (existingLayers) {
      existingLayers.forEach((ly) => map.removeLayer(ly));
    }
    (map as any)._troposOverlayLayers = [];

    // Draw particle paths
    if (particlePaths && particlePaths.length > 0) {
      particlePaths.forEach((path) => {
        try {
          const latlngs = path.map((p) => [p.lat, p.lng] as [number, number]);
          const poly = leaflet.polyline(latlngs, { color: '#ffb84d', weight: 1, opacity: 0.7, pane: 'overlayPane' }).addTo(map);
          (map as any)._troposOverlayLayers.push(poly);
        } catch (e) {
          // ignore render errors
        }
      });
    }

    // Draw envelope polygon
    if (envelope && envelope.length > 2) {
      try {
        const latlngs = envelope.map((p) => [p.lat, p.lng] as [number, number]);
        const poly = leaflet.polygon(latlngs, { color: '#ff7a59', weight: 1.5, opacity: 0.9, fillOpacity: 0.12 }).addTo(map);
        (map as any)._troposOverlayLayers.push(poly);
      } catch {}
    }

    // Draw candidate markers
    if (candidates && candidates.length > 0) {
      candidates.forEach((c) => {
        try {
          const m = leaflet.circleMarker([c.lat, c.lng], { radius: 6, color: '#2997ff', fillColor: '#2997ff', fillOpacity: 0.95 }).addTo(map);
          (map as any)._troposOverlayLayers.push(m);
        } catch {}
      });
    }

    // Highlight probable source (if it matches a station id)
    if (highlightedSourceId) {
      const st = stations.find((s) => s.id === highlightedSourceId);
      if (st) {
        try {
          const m = leaflet.circleMarker([st.lat, st.lng], { radius: 8, color: '#ff2d55', fillColor: '#ff2d55', fillOpacity: 0.98 }).addTo(map);
          (map as any)._troposOverlayLayers.push(m);
          // pan a little towards source for emphasis
          // map.panTo([st.lat, st.lng]);
        } catch {}
      }
    }

    if (onMapReady) {
      try { onMapReady(map); } catch {}
    }

    return () => {
      const layers = (map as any)._troposOverlayLayers || [];
      layers.forEach((ly: any) => map.removeLayer(ly));
      (map as any)._troposOverlayLayers = [];
    };
  }, [mapReady, particlePaths, envelope, candidates, highlightedSourceId, stations, onMapReady]);

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
              {activeStation.status} · {activeStation.provider || (activeStation.source === "openaq" ? "OpenAQ" : "CPCB")}
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
