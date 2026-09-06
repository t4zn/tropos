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
  geeLayer?: "none" | "s5p-aai" | "s5p-no2";
  onGeeLayerChange?: (layer: "none" | "s5p-aai" | "s5p-no2") => void;
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
  geeLayer = "none",
  onGeeLayerChange,
}: CorridorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const geeLayersRef = useRef<import("leaflet").Layer[]>([]);

  // States
  const [mapReady, setMapReady] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<CorridorStation | null>(null);
  const [activeGeeLayer, setActiveGeeLayer] = useState<"none" | "s5p-aai" | "s5p-no2">(geeLayer);

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

      const corridorBounds = L.latLngBounds(
        [27.5, 74.5],
        [31.8, 78.5]
      );

      const initialCenter: [number, number] = selectedStation
        ? [selectedStation.lat, selectedStation.lng]
        : [28.6139, 77.209];

      const map = L.map(container, {
        center: initialCenter,
        zoom: selectedStation ? 11 : 10,
        minZoom: 6,
        maxZoom: 18,
        maxBounds: corridorBounds,
        maxBoundsViscosity: 0.6,
        zoomControl: false,
        attributionControl: false,
      });

      if (selectedStation) {
        map.setView([selectedStation.lat, selectedStation.lng], 11);
      } else {
        const delhiBounds = L.latLngBounds([28.30, 76.84], [28.90, 77.60]);
        map.fitBounds(delhiBounds, { padding: [16, 16] });
      }

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
          const isHighlighted = highlightedSourceId === c.id;
          const m = leaflet.circleMarker([c.lat, c.lng], {
            radius: isHighlighted ? 9 : 6,
            color: isHighlighted ? "#ff2d55" : "#2997ff",
            fillColor: isHighlighted ? "#ff2d55" : "#2997ff",
            fillOpacity: isHighlighted ? 1.0 : 0.9,
            weight: isHighlighted ? 3 : 1.5,
          }).addTo(map);

          m.bindTooltip(`🏭 ${c.name}`, {
            direction: "top",
            offset: [0, -8],
            className: isHighlighted ? "tropos-tooltip-highlight" : "tropos-tooltip",
          });

          if (isHighlighted) {
            m.openTooltip();
          }

          (map as any)._troposOverlayLayers.push(m);
        } catch {}
      });
    }

    // Auto-fit map to fit receptor, plume, and candidate emitters so nothing is hidden off-screen
    if ((particlePaths && particlePaths.length > 0) || (candidates && candidates.length > 0)) {
      try {
        const boundsPoints: [number, number][] = [];
        if (selectedStation) {
          boundsPoints.push([selectedStation.lat, selectedStation.lng]);
        }
        candidates?.forEach((c) => boundsPoints.push([c.lat, c.lng]));
        particlePaths?.forEach((path) => {
          const end = path[path.length - 1];
          if (end) boundsPoints.push([end.lat, end.lng]);
        });

        if (boundsPoints.length >= 2) {
          const bounds = leaflet.latLngBounds(boundsPoints);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }
      } catch {}
    }

    // Highlight and pan to selected candidate source
    if (highlightedSourceId) {
      const cand = candidates?.find((c) => c.id === highlightedSourceId);
      if (cand) {
        try {
          map.flyTo([cand.lat, cand.lng], 13, { duration: 0.6 });
        } catch {}
      } else {
        const st = stations.find((s) => s.id === highlightedSourceId);
        if (st) {
          try {
            const m = leaflet.circleMarker([st.lat, st.lng], {
              radius: 9,
              color: "#ff2d55",
              fillColor: "#ff2d55",
              fillOpacity: 0.98,
              weight: 3,
            }).addTo(map);
            (map as any)._troposOverlayLayers.push(m);
          } catch {}
        }
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

  // ─── 5. Render Google Earth Engine (GEE) Sentinel-5P Layers ──────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    // Clear previous GEE layers
    geeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    geeLayersRef.current = [];

    if (activeGeeLayer === "none") return;

    // Dynamically import GEE data
    import("@/lib/earthEngine").then(({ getGeeHarmonizationData }) => {
      const geeData = getGeeHarmonizationData();

      geeData.gridCells.forEach((cell) => {
        const isAai = activeGeeLayer === "s5p-aai";
        const val = isAai ? cell.aai : cell.no2TroposphericMolM2;

        // Color coding matching Copernicus Sentinel-5P palettes
        let fillColor = "#ffd000";
        if (isAai) {
          fillColor = cell.aai > 3.5 ? "#be123c" : cell.aai > 2.5 ? "#f97316" : "#eab308";
        } else {
          fillColor = cell.no2TroposphericMolM2 > 65 ? "#7c3aed" : cell.no2TroposphericMolM2 > 45 ? "#2563eb" : "#06b6d4";
        }

        // Create 3.5km TROPOMI satellite resolution footprint
        const circle = leaflet.circle([cell.lat, cell.lng], {
          radius: 3800,
          color: fillColor,
          fillColor: fillColor,
          fillOpacity: 0.28,
          weight: 1.5,
          dashArray: "4, 4",
        }).addTo(map);

        circle.bindTooltip(
          `<div style="font-family: var(--font-inter, sans-serif); padding: 4px 6px;">
            <div style="font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase;">Google Earth Engine • S5P</div>
            <div style="font-size: 12px; font-weight: 600; color: #ffffff; margin: 2px 0;">${cell.label}</div>
            <div style="font-size: 11px; color: #cbd5e1;">
              ${isAai ? `Absorbing Aerosol Index: <b>${cell.aai.toFixed(2)}</b>` : `Tropospheric NO₂: <b>${cell.no2TroposphericMolM2.toFixed(1)} µmol/m²</b>`}
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
              MODIS AOD: ${cell.opticalDepthModis.toFixed(2)} · Inversion Lid: ${cell.pblHeightM}m
            </div>
          </div>`,
          { className: "tropos-tooltip", sticky: true }
        );

        geeLayersRef.current.push(circle);
      });
    });

    return () => {
      geeLayersRef.current.forEach((layer) => map.removeLayer(layer));
      geeLayersRef.current = [];
    };
  }, [activeGeeLayer, mapReady]);

  const handleLayerSwitch = (newLayer: "none" | "s5p-aai" | "s5p-no2") => {
    setActiveGeeLayer(newLayer);
    if (onGeeLayerChange) onGeeLayerChange(newLayer);
  };

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

      {/* ── TOP-LEFT: Google Earth Engine Orbital Telemetry Badge ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          zIndex: 10,
          backgroundColor: "rgba(18, 18, 20, 0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "9999px",
          padding: "6px 14px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: 500,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            boxShadow: "0 0 8px #22c55e",
          }}
        />
        <span>Google Earth Engine &bull; Sentinel-5P TROPOMI</span>
      </div>

      {/* ── TOP-RIGHT: Google Earth Engine Layer Switcher ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 10,
          backgroundColor: "rgba(18, 18, 20, 0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "12px",
          padding: "4px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          display: "flex",
          gap: "4px",
        }}
      >
        <button
          type="button"
          onClick={() => handleLayerSwitch("none")}
          style={{
            background: activeGeeLayer === "none" ? "#0066cc" : "transparent",
            color: activeGeeLayer === "none" ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
            border: "none",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Ground Stations
        </button>
        <button
          type="button"
          onClick={() => handleLayerSwitch("s5p-aai")}
          style={{
            background: activeGeeLayer === "s5p-aai" ? "#0066cc" : "transparent",
            color: activeGeeLayer === "s5p-aai" ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
            border: "none",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          GEE S5P Aerosols (AAI)
        </button>
        <button
          type="button"
          onClick={() => handleLayerSwitch("s5p-no2")}
          style={{
            background: activeGeeLayer === "s5p-no2" ? "#0066cc" : "transparent",
            color: activeGeeLayer === "s5p-no2" ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
            border: "none",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          GEE S5P NO₂
        </button>
      </div>

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
              {activeStation.status} · {activeStation.provider || "OpenWeather"}
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
