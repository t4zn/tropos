"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  rgbToAod,
  latLngToPixel,
  computeAqi,
  type AqiResult,
} from "@/lib/aodToAqi";

// Lazy-load Leaflet only on client
let L: typeof import("leaflet") | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// CARTO BASEMAP WITH USER API KEY & CRISP BOUNDARIES
// ═══════════════════════════════════════════════════════════════════════════════

const CARTO_KEY =
  process.env.NEXT_PUBLIC_CARTO_KEY || "cb1_2w21_1_6b9637356383522e7d351a45";

// High-contrast clean dark basemap with international & administrative borders
const DARK_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`;


// ═══════════════════════════════════════════════════════════════════════════════
// MOSDAC INSAT-3DS AOD EXACT GRID BOUNDS
// Equirectangular projection verified against 50°–90°E and 0°–40°N grid marks:
// SW: [-10.01°S, 45.05°E], NE: [51.65°N, 100.06°E]
// ═══════════════════════════════════════════════════════════════════════════════

const AOD_BOUNDS: [[number, number], [number, number]] = [
  [-10.01, 45.05],
  [51.65, 100.06],
];

const INDIA_CENTER: [number, number] = [22.5, 78.5];
const INDIA_ZOOM = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE INDIAN MONITORING SECTORS
// Comprehensive coverage of all key geographic / aerosol basins
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegionHotspot {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  zoom: number;
  state: string;
  baselineAod: number;
  status: "Very Clean" | "Clean" | "Low Aerosol" | "Moderate" | "Moderate-High" | "High" | "Severe";
  description: string;
  derivedAqi?: AqiResult;
}

export const REGION_SECTORS: RegionHotspot[] = [
  {
    id: "delhi-ncr",
    name: "Delhi NCR",
    zone: "Indo-Gangetic Corridor Epicenter",
    lat: 28.6139,
    lng: 77.209,
    zoom: 9,
    state: "National Capital Region",
    baselineAod: 0.58,
    status: "Moderate-High",
    description: "High aerosol concentration zone influenced by vehicular, urban, and seasonal crop residue transport.",
  },
  {
    id: "punjab-belt",
    name: "Punjab & Haryana",
    zone: "Agricultural Biomass Corridor",
    lat: 30.7333,
    lng: 76.2,
    zoom: 8,
    state: "Punjab / Haryana",
    baselineAod: 0.52,
    status: "Moderate-High",
    description: "Agricultural heartland with seasonal biomass burning and intense post-monsoon inversion layers.",
  },
  {
    id: "lucknow-up",
    name: "Lucknow & Central UP",
    zone: "Middle Gangetic Basin",
    lat: 26.8467,
    lng: 80.9462,
    zoom: 8,
    state: "Uttar Pradesh",
    baselineAod: 0.44,
    status: "Moderate",
    description: "Dense river basin corridor with slow dispersion during atmospheric boundary layer subsidence.",
  },
  {
    id: "varanasi-corridor",
    name: "Varanasi Corridor",
    zone: "Eastern Gangetic Plain",
    lat: 25.3176,
    lng: 82.9739,
    zoom: 9,
    state: "Uttar Pradesh",
    baselineAod: 0.41,
    status: "Moderate",
    description: "Downwind corridor accumulating aerosol plume drift across the northern river valleys.",
  },
  {
    id: "patna-plains",
    name: "Patna Plains",
    zone: "Lower Gangetic Basin",
    lat: 25.6127,
    lng: 85.1411,
    zoom: 9,
    state: "Bihar",
    baselineAod: 0.38,
    status: "Moderate",
    description: "Moisture-rich river basin with humid haze formations during transition seasons.",
  },
  {
    id: "kolkata-delta",
    name: "Kolkata & Delta",
    zone: "Bengal Delta Marine Interface",
    lat: 22.5726,
    lng: 88.3639,
    zoom: 9,
    state: "West Bengal",
    baselineAod: 0.32,
    status: "Moderate",
    description: "Deltaic coastal zone interacting with Bay of Bengal sea-breeze circulations.",
  },
  {
    id: "mumbai-coast",
    name: "Mumbai Coastal",
    zone: "Arabian Sea Marine Boundary",
    lat: 19.076,
    lng: 72.8777,
    zoom: 9,
    state: "Maharashtra",
    baselineAod: 0.28,
    status: "Low Aerosol",
    description: "Coastal metropolis moderated by strong onshore sea breeze and high boundary layer mixing.",
  },
  {
    id: "ahmedabad-arid",
    name: "Ahmedabad & Gujarat",
    zone: "Semi-Arid Industrial Corridor",
    lat: 23.0225,
    lng: 72.5714,
    zoom: 8,
    state: "Gujarat",
    baselineAod: 0.36,
    status: "Moderate",
    description: "Mineral dust mixed with industrial emissions along the Gulf of Khambhat interface.",
  },
  {
    id: "bengaluru-plateau",
    name: "Bengaluru Urban",
    zone: "Deccan High-Plateau (920m)",
    lat: 12.9716,
    lng: 77.5946,
    zoom: 9,
    state: "Karnataka",
    baselineAod: 0.18,
    status: "Clean",
    description: "High-elevation plateau with active diurnal ventilation and low baseline aerosol loading.",
  },
  {
    id: "hyderabad-deccan",
    name: "Hyderabad Central",
    zone: "Telangana Deccan Interior",
    lat: 17.385,
    lng: 78.4867,
    zoom: 9,
    state: "Telangana",
    baselineAod: 0.24,
    status: "Low Aerosol",
    description: "Inland plateau basin with moderate convective dispersion throughout the afternoon.",
  },
  {
    id: "chennai-coast",
    name: "Chennai Coastal",
    zone: "Coromandel Marine Sector",
    lat: 13.0827,
    lng: 80.2707,
    zoom: 9,
    state: "Tamil Nadu",
    baselineAod: 0.22,
    status: "Clean",
    description: "Maritime boundary layer with marine salt aerosols dominant over anthropogenic particles.",
  },
  {
    id: "guwahati-river",
    name: "Guwahati Valley",
    zone: "Brahmaputra River Basin",
    lat: 26.1445,
    lng: 91.7362,
    zoom: 8,
    state: "Assam",
    baselineAod: 0.16,
    status: "Clean",
    description: "Lush valley flanked by hills, high vegetation cover and clean Himalayan air currents.",
  },
  {
    id: "srinagar-valley",
    name: "Srinagar & Kashmir",
    zone: "Himalayan Alpine Basin (1600m)",
    lat: 34.0837,
    lng: 74.7973,
    zoom: 9,
    state: "Jammu & Kashmir",
    baselineAod: 0.08,
    status: "Very Clean",
    description: "Pristine alpine valley with minimal background aerosol; localized winter heating signatures.",
  },
  {
    id: "jaipur-thar",
    name: "Jaipur & Thar Border",
    zone: "Aravalli Desert Boundary",
    lat: 26.9124,
    lng: 75.7873,
    zoom: 8,
    state: "Rajasthan",
    baselineAod: 0.34,
    status: "Moderate",
    description: "Windblown mineral dust transport from the Thar desert interacting with urban aerosol.",
  },
  {
    id: "nagpur-transit",
    name: "Nagpur Central",
    zone: "Geographic Center & Transit Hub",
    lat: 21.1458,
    lng: 79.0882,
    zoom: 8,
    state: "Maharashtra",
    baselineAod: 0.26,
    status: "Low Aerosol",
    description: "Central Indian plains with expansive agricultural corridors and good wind dispersion.",
  },
  {
    id: "indore-plateau",
    name: "Indore & Malwa",
    zone: "Central Malwa Agricultural & Urban Sector",
    lat: 22.7467,
    lng: 75.8928,
    zoom: 9,
    state: "Madhya Pradesh",
    baselineAod: 0.22,
    status: "Clean",
    description: "Central high plateau with excellent convective ventilation and consistently clean-to-moderate baseline air.",
  },
];

// Quick jump filter chips
export const QUICK_FILTERS = [
  { label: "All India", lat: 22.5, lng: 78.5, zoom: 5 },
  { label: "Indo-Gangetic Plain", lat: 27.5, lng: 80.5, zoom: 7 },
  { label: "Delhi NCR", lat: 28.6139, lng: 77.209, zoom: 9 },
  { label: "Punjab Belt", lat: 30.7333, lng: 76.2, zoom: 8 },
  { label: "Indore & Central", lat: 22.7467, lng: 75.8928, zoom: 8 },
  { label: "Mumbai & West", lat: 20.5, lng: 73.5, zoom: 7 },
  { label: "Kolkata & East", lat: 23.5, lng: 87.5, zoom: 7 },
  { label: "Bengaluru & South", lat: 14.5, lng: 78.0, zoom: 7 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// AOD SCALE COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const AOD_SCALE_COLORS: Record<string, string> = {
  "Very Clean": "#1a237e",
  Clean: "#1565c0",
  "Low Aerosol": "#42a5f5",
  Moderate: "#66bb6a",
  "Moderate-High": "#ffca28",
  High: "#ff9800",
  "Very High": "#e53935",
  Severe: "#6a1b9a",
};

const AOD_LEGEND = [
  { label: "< 0.1", color: "#1a237e", desc: "Very Clean" },
  { label: "0.1–0.2", color: "#1565c0", desc: "Clean" },
  { label: "0.2–0.3", color: "#42a5f5", desc: "Low Aerosol" },
  { label: "0.3–0.5", color: "#66bb6a", desc: "Moderate" },
  { label: "0.5–0.7", color: "#ffca28", desc: "Mod-High" },
  { label: "0.7–1.0", color: "#ff9800", desc: "High" },
  { label: "1.0–1.5", color: "#e53935", desc: "Very High" },
  { label: "> 1.5", color: "#6a1b9a", desc: "Severe" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT PROPS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AodMapProps {
  imageUrl: string | null;
  opacity?: number;
  timeLabel?: string;
  dateLabel?: string;
  selectedSectorId?: string | null;
  onSectorSelect?: (sector: RegionHotspot) => void;
  weather?: {
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
  } | null;
  fires?: Array<{
    lat: number;
    lng: number;
    brightness: number;
    acqDate: string;
    acqTime: string;
    confidence: string;
    frp: number;
  }>;
}

export default function AodMap({
  imageUrl,
  opacity = 0.7,
  timeLabel,
  dateLabel,
  selectedSectorId = null,
  onSectorSelect,
  weather,
  fires = [],
}: AodMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const fireMarkersRef = useRef<import("leaflet").CircleMarker[]>([]);

  // States
  const [mapReady, setMapReady] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(opacity);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionHotspot | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionHotspot | null>(null);
  const [showFires, setShowFires] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All India");

  // Real-time derived AQI dictionary keyed by sector ID
  const [derivedAqiMap, setDerivedAqiMap] = useState<Record<string, AqiResult>>({});
  const [legendMode, setLegendMode] = useState<"aqi" | "aod">("aqi");

  const activeRegion = hoveredRegion || selectedRegion;

  // ─── 1. Initialize Map ──────────────────────────────────────────────────
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

      const map = L.map(container, {
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        minZoom: 4,
        maxZoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      if (isCancelled) {
        map.remove();
        return;
      }

      // Clean dark basemap with borders, coastlines, and geography
      L.tileLayer(DARK_TILE_URL, {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Zoom control — bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Track cursor position
      map.on("mousemove", (e: import("leaflet").LeafletMouseEvent) => {
        setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.on("mouseout", () => setCursorCoords(null));
      map.on("click", () => setSelectedRegion(null));

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

  // ─── 2. MOSDAC AOD Background Radiance Ingestion for Real-Time AQI ───────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;

    // Remove any previous image overlay if present
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    setImageLoaded(false);
    setImageError(false);

    if (!imageUrl) {
      // Compute baseline AQIs if no image URL
      const pblh = weather?.boundaryLayerEstimate ?? 550;
      const rh = weather?.humidity ?? 50;
      const fallbackAqis: Record<string, AqiResult> = {};
      REGION_SECTORS.forEach((region) => {
        fallbackAqis[region.id] = computeAqi(region.baselineAod, pblh, rh);
      });
      setDerivedAqiMap(fallbackAqis);
      return;
    }

    // Load image in memory only for off-screen canvas sampling (DO NOT render on map)
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageLoaded(true);

      // ── Physical Ingestion: Canvas Sampling of MOSDAC Radiance ──
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1200;
        canvas.height = img.naturalHeight || img.height || 900;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pblh = weather?.boundaryLayerEstimate ?? 550;
          const rh = weather?.humidity ?? 50;

          const updatedAqis: Record<string, AqiResult> = {};

          REGION_SECTORS.forEach((region) => {
            const pixel = latLngToPixel(region.lat, region.lng, canvas.width, canvas.height);
            let aodVal = region.baselineAod;

            if (pixel && pixel.x >= 0 && pixel.x < canvas.width && pixel.y >= 0 && pixel.y < canvas.height) {
              const pixelData = ctx.getImageData(pixel.x, pixel.y, 1, 1).data;
              const sampledAod = rgbToAod(pixelData[0], pixelData[1], pixelData[2]);
              // Only override baseline if a valid non-background aerosol pixel is detected
              if (sampledAod !== null && sampledAod >= 0.20) {
                aodVal = sampledAod;
              }
            }

            // Convert AOD to ground PM2.5 and Indian National AQI
            updatedAqis[region.id] = computeAqi(aodVal, pblh, rh);
          });

          setDerivedAqiMap(updatedAqis);
        }
      } catch (err) {
        // Fallback to baseline AOD calculation if CORS or offscreen canvas restrictions occur
        const pblh = weather?.boundaryLayerEstimate ?? 550;
        const rh = weather?.humidity ?? 50;
        const fallbackAqis: Record<string, AqiResult> = {};
        REGION_SECTORS.forEach((region) => {
          fallbackAqis[region.id] = computeAqi(region.baselineAod, pblh, rh);
        });
        setDerivedAqiMap(fallbackAqis);
      }
    };
    img.onerror = () => {
      setImageError(true);
      const pblh = weather?.boundaryLayerEstimate ?? 550;
      const rh = weather?.humidity ?? 50;
      const fallbackAqis: Record<string, AqiResult> = {};
      REGION_SECTORS.forEach((region) => {
        fallbackAqis[region.id] = computeAqi(region.baselineAod, pblh, rh);
      });
      setDerivedAqiMap(fallbackAqis);
    };
    img.src = imageUrl;

    return () => {
      if (overlayRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [imageUrl, mapReady, weather]);

  // ─── 3. Render Regional Hotspots (Interactive Hover & Click) ──────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    REGION_SECTORS.forEach((region) => {
      const isSelected = selectedRegion?.id === region.id;
      const isHovered = hoveredRegion?.id === region.id;

      // Extract real-time derived AQI if available
      const derived = derivedAqiMap[region.id];
      const activeAqi = derived ? derived.aqi : Math.round(region.baselineAod * 260);
      const activeCategory = derived ? derived.category : region.status;
      const dotColor = derived ? derived.color : (AOD_SCALE_COLORS[region.status] ?? "#2997ff");
      const activeAod = derived ? derived.aod : region.baselineAod;

      const markerHtml = `
        <div class="tropos-station-marker dark-mode ${isSelected || isHovered ? "selected" : ""}" id="region-${region.id}">
          <div class="tropos-marker-badge" style="gap: 6px; padding: 4px 10px; background: rgba(18, 18, 22, 0.92); border: 1px solid ${dotColor}60; box-shadow: 0 4px 16px rgba(0,0,0,0.6);">
            <span class="tropos-marker-dot" style="background-color: ${dotColor}; color: ${dotColor}; box-shadow: 0 0 10px ${dotColor};">
              <span class="tropos-marker-pulse"></span>
            </span>
            <span style="font-size: 11px; font-weight: 600; color: #fff;">${region.name}</span>
            <span style="font-size: 11px; color: ${dotColor}; font-weight: 800; font-family: 'SF Mono', monospace;">AQI ${activeAqi}</span>
          </div>
        </div>
      `;

      const icon = leaflet.divIcon({
        html: markerHtml,
        className: "tropos-custom-pin",
        iconSize: [136, 28],
        iconAnchor: [68, 14],
      });

      const marker = leaflet.marker([region.lat, region.lng], { icon }).addTo(map);

      // Tooltip with sector info
      marker.bindTooltip(
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; font-size: 11px; padding: 2px 4px;">
          <div style="font-weight: 700; color: #fff; margin-bottom: 2px;">${region.name} · ${region.state}</div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: ${dotColor}; font-weight: 700;">Live AQI ${activeAqi} (${activeCategory})</span>
          </div>
          <div style="color: rgba(255,255,255,0.5); font-size: 10px; margin-top: 2px;">
            ISRO AOD τ: ${activeAod.toFixed(2)} · PM2.5: ${derived ? `${derived.pm25} µg/m³` : "—"}
          </div>
        </div>`,
        {
          direction: "top",
          offset: [0, -14],
          className: "tropos-tooltip",
        }
      );

      // Hover interactions
      marker.on("mouseover", () => setHoveredRegion(region));
      marker.on("mouseout", () =>
        setHoveredRegion((c) => (c?.id === region.id ? null : c))
      );

      // Click to select & flyTo
      marker.on("click", (e) => {
        leaflet.DomEvent.stopPropagation(e);
        setSelectedRegion(region);
        map.flyTo([region.lat, region.lng], region.zoom, { duration: 0.8 });
        onSectorSelect?.(region);
      });

      markersRef.current.push(marker);
    });
  }, [mapReady, selectedRegion, hoveredRegion, onSectorSelect, derivedAqiMap]);

  // Sync external selectedSectorId prop
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedSectorId) return;
    const target = REGION_SECTORS.find((s) => s.id === selectedSectorId);
    if (target) {
      setSelectedRegion(target);
      mapInstanceRef.current.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
    }
  }, [mapReady, selectedSectorId]);

  // ─── 4. Render NASA FIRMS Fire Hotspots ────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    fireMarkersRef.current.forEach((m) => m.remove());
    fireMarkersRef.current = [];

    if (!showFires || !fires || fires.length === 0) return;

    fires.forEach((fire) => {
      const circle = leaflet.circleMarker([fire.lat, fire.lng], {
        radius: 4,
        fillColor: "#ff453a",
        color: "#ff9f0a",
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.8,
        className: "tropos-fire-pin",
      }).addTo(map);

      circle.bindTooltip(
        `<div style="font-family: SF Mono, monospace; font-size: 10px; color: #fff;">
          <span style="color: #ff453a; font-weight: 600;">FIRE HOTSPOT</span> · FRP: ${fire.frp.toFixed(1)} MW<br/>
          ${fire.lat.toFixed(2)}°N, ${fire.lng.toFixed(2)}°E · ${fire.confidence} conf
        </div>`,
        { direction: "top", offset: [0, -6], className: "tropos-tooltip" }
      );

      fireMarkersRef.current.push(circle);
    });
  }, [mapReady, fires, showFires]);

  // ─── Quick Jump to Region ────────────────────────────────────────────────
  const handleQuickJump = useCallback(
    (filter: (typeof QUICK_FILTERS)[0]) => {
      setActiveFilter(filter.label);
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.flyTo([filter.lat, filter.lng], filter.zoom, {
        duration: 0.8,
      });
      const match = REGION_SECTORS.find(
        (r) => Math.abs(r.lat - filter.lat) < 0.1 && Math.abs(r.lng - filter.lng) < 0.1
      );
      setSelectedRegion(match ?? null);
      if (match && onSectorSelect) {
        onSectorSelect(match);
      }
    },
    [onSectorSelect]
  );

  // ─── Update Opacity ──────────────────────────────────────────────────────
  const handleOpacityChange = useCallback((val: number) => {
    setOverlayOpacity(val);
    if (overlayRef.current) {
      overlayRef.current.setOpacity(val);
    }
  }, []);

  // ─── Dynamic Sector from mouse coordinates ──────────────────────────────
  function resolveNearestSector(lat: number, lng: number): string {
    let nearest: RegionHotspot | null = null;
    let minDist = Infinity;
    for (const r of REGION_SECTORS) {
      const d = Math.hypot(lat - r.lat, lng - r.lng);
      if (d < minDist) {
        minDist = d;
        nearest = r;
      }
    }
    if (nearest && minDist < 2.0) {
      return `${nearest.name} (${nearest.zone})`;
    }
    if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) return "Indian Subcontinent";
    return "South Asia Basin";
  }

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
      {/* ── Top Bar: Quick Jump Sector Pills ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 800,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "9999px",
          backgroundColor: "rgba(18, 18, 20, 0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          maxWidth: "92%",
          overflowX: "auto",
        }}
      >
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => handleQuickJump(f)}
            style={{
              padding: "5px 12px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor:
                activeFilter === f.label ? "#2997ff" : "rgba(255, 255, 255, 0.05)",
              color: activeFilter === f.label ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Leaflet Map Container ── */}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      />

      {/* ── Loading state ── */}
      {!imageLoaded && !imageError && imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 700,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderRadius: "14px",
              backgroundColor: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(16px)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                width: "18px",
                height: "18px",
                border: "2px solid rgba(255,255,255,0.15)",
                borderTop: "2px solid #2997ff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            Synchronizing ISRO INSAT-3DS AOD scan…
          </div>
        </div>
      )}

      {/* ── Top-Left: Sensor Status & Controls ── */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "14px",
          zIndex: 800,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderRadius: "12px",
            backgroundColor: "rgba(18, 18, 20, 0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: imageLoaded ? "#30d158" : "#ff9f0a",
              boxShadow: imageLoaded ? "0 0 8px #30d158" : "none",
            }}
          />
          <span style={{ color: "#ffffff", fontWeight: 600 }}>INSAT-3DS</span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
          <span style={{ color: "#2997ff", fontWeight: 500 }}>L2G AOD</span>
          {timeLabel && (
            <>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontFamily: "SF Mono, monospace" }}>
                {timeLabel}
              </span>
            </>
          )}
        </div>

        {/* Fires overlay toggle */}
        {fires && fires.length > 0 && (
          <button
            onClick={() => setShowFires((prev) => !prev)}
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              backgroundColor: showFires
                ? "rgba(255, 69, 58, 0.15)"
                : "rgba(18, 18, 20, 0.85)",
              border: showFires
                ? "1px solid rgba(255, 69, 58, 0.4)"
                : "1px solid rgba(255,255,255,0.1)",
              color: showFires ? "#ff453a" : "rgba(255,255,255,0.5)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(20px)",
              transition: "all 0.2s ease",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#ff453a",
              }}
            />
            NASA FIRMS Fires ({fires.length})
          </button>
        )}
      </div>

      {/* ── Bottom-Left: Interactive Sector Hover / Selected Card (Corridor Style) ── */}
      {activeRegion ? (() => {
        const derived = derivedAqiMap[activeRegion.id];
        const activeAqi = derived ? derived.aqi : Math.round(activeRegion.baselineAod * 260);
        const activeCategory = derived ? derived.category : activeRegion.status;
        const activeColor = derived ? derived.color : (AOD_SCALE_COLORS[activeRegion.status] ?? "#2997ff");
        const activeAod = derived ? derived.aod : activeRegion.baselineAod;
        const activePm25 = derived ? derived.pm25 : Math.round((activeAod * 2600) / (weather?.boundaryLayerEstimate || 550));

        return (
          <div
            style={{
              position: "absolute",
              bottom: "14px",
              left: "14px",
              zIndex: 850,
              width: "360px",
              maxWidth: "calc(100% - 28px)",
              borderRadius: "14px",
              backgroundColor: "rgba(18, 18, 20, 0.94)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
              padding: "16px 18px",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.2px" }}>
                  {activeRegion.name}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "1px" }}>
                  {activeRegion.zone} · {activeRegion.state}
                </div>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 9px",
                  borderRadius: "9999px",
                  backgroundColor: `${activeColor}22`,
                  border: `1px solid ${activeColor}66`,
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: activeColor,
                    boxShadow: `0 0 8px ${activeColor}`,
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: activeColor,
                    fontFamily: "'SF Mono', monospace",
                  }}
                >
                  AQI {activeAqi} · {activeCategory}
                </span>
              </div>
            </div>

            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "0 0 12px", lineHeight: 1.4 }}>
              {activeRegion.description}
            </p>

            {/* Telemetry Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  ISRO AOD τ
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#2997ff", fontFamily: "SF Mono, monospace" }}>
                  {activeAod.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  Est. PM2.5
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: activeColor, fontFamily: "SF Mono, monospace" }}>
                  {activePm25} <span style={{ fontSize: "8px", fontWeight: 400 }}>µg</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  PBLH Dilution
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>
                  {weather ? `${weather.boundaryLayerEstimate}m` : "550m"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  FIRMS Fires
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: fires.length > 0 ? "#ff453a" : "#30d158" }}>
                  {fires.length > 0 ? `${fires.length}` : "0"}
                </div>
              </div>
            </div>

            {/* Action to fly to region if hovered */}
            {hoveredRegion && !selectedRegion && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <span style={{ fontSize: "10px", color: "#2997ff", fontWeight: 500 }}>
                  Click marker to inspect sector →
                </span>
              </div>
            )}
          </div>
        );
      })() : cursorCoords ? (
        /* Coordinates HUD when not hovering a specific pin */
        <div
          style={{
            position: "absolute",
            bottom: "14px",
            left: "14px",
            zIndex: 800,
            padding: "8px 14px",
            borderRadius: "10px",
            backgroundColor: "rgba(18, 18, 20, 0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "11px",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "SF Mono, monospace" }}>
            {cursorCoords.lat.toFixed(3)}°N, {cursorCoords.lng.toFixed(3)}°E
          </span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span style={{ color: "#2997ff", fontWeight: 600 }}>
            {resolveNearestSector(cursorCoords.lat, cursorCoords.lng)}
          </span>
        </div>
      ) : null}

      {/* ── Bottom-Right: Dual Mode Legend (Indian AQI / ISRO AOD) ── */}
      <div
        style={{
          position: "absolute",
          bottom: "14px",
          right: "14px",
          zIndex: 800,
          padding: "10px 14px",
          borderRadius: "12px",
          backgroundColor: "rgba(18, 18, 20, 0.88)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => setLegendMode("aqi")}
              style={{
                background: legendMode === "aqi" ? "rgba(41,151,255,0.2)" : "transparent",
                border: legendMode === "aqi" ? "1px solid #2997ff" : "none",
                color: legendMode === "aqi" ? "#2997ff" : "rgba(255,255,255,0.4)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "9px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Indian AQI
            </button>
            <button
              onClick={() => setLegendMode("aod")}
              style={{
                background: legendMode === "aod" ? "rgba(41,151,255,0.2)" : "transparent",
                border: legendMode === "aod" ? "1px solid #2997ff" : "none",
                color: legendMode === "aod" ? "#2997ff" : "rgba(255,255,255,0.4)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "9px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ISRO AOD
            </button>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
            {legendMode === "aqi" ? "CPCB Scale" : "550nm"}
          </span>
        </div>

        {legendMode === "aqi" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2px 12px" }}>
            {[
              { label: "0–50", color: "#009966", desc: "Good" },
              { label: "51–100", color: "#58bc2b", desc: "Satisfactory" },
              { label: "101–200", color: "#ffbf00", desc: "Moderate" },
              { label: "201–300", color: "#ff9800", desc: "Poor" },
              { label: "301–400", color: "#e53935", desc: "Very Poor" },
              { label: "401–500", color: "#880e4f", desc: "Severe" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", minWidth: "44px" }}>
                  {item.label}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "2px 12px" }}>
            {AOD_LEGEND.map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", minWidth: "44px" }}>
                  {item.label}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)" }}>
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
