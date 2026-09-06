"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Lazy-load Leaflet only on client
let L: typeof import("leaflet") | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// BASEMAP — Dark CartoDB for clean contrast with the AOD overlay
// ═══════════════════════════════════════════════════════════════════════════════

const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const LABELS_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";

// ═══════════════════════════════════════════════════════════════════════════════
// INSAT-3DS full-disk image bounds
// The satellite sits at 82°E, imaging roughly 45°S–45°N, 7°E–157°E.
// For the preview images the actual rendered area for India coverage is approx:
// We'll crop to the Indian subcontinent region for the overlay.
// ═══════════════════════════════════════════════════════════════════════════════

// INSAT-3DS full-disk image geographic extent (approximate)
// The preview images are equirectangular crops centred on the satellite sub-point
const AOD_BOUNDS: [[number, number], [number, number]] = [
  [-45, 7],   // SW corner (lat, lng)
  [45, 157],  // NE corner (lat, lng)
];

// India-focused view
const INDIA_CENTER: [number, number] = [22.5, 78.5];
const INDIA_ZOOM = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// AOD Color Legend — maps AOD values to colors shown on the MOSDAC image
// ═══════════════════════════════════════════════════════════════════════════════

const AOD_LEGEND = [
  { label: "< 0.1", color: "#1a237e", desc: "Very Clean" },
  { label: "0.1–0.2", color: "#1565c0", desc: "Clean" },
  { label: "0.2–0.3", color: "#42a5f5", desc: "Low Aerosol" },
  { label: "0.3–0.5", color: "#66bb6a", desc: "Moderate" },
  { label: "0.5–0.7", color: "#ffca28", desc: "Moderate-High" },
  { label: "0.7–1.0", color: "#ff9800", desc: "High" },
  { label: "1.0–1.5", color: "#e53935", desc: "Very High" },
  { label: "> 1.5", color: "#6a1b9a", desc: "Severe" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Component Props
// ═══════════════════════════════════════════════════════════════════════════════

interface AodMapProps {
  /** The AOD image URL from MOSDAC */
  imageUrl: string | null;
  /** Opacity control (0–1) */
  opacity?: number;
  /** IST time label for display */
  timeLabel?: string;
  /** Date label */
  dateLabel?: string;
}

export default function AodMap({
  imageUrl,
  opacity = 0.7,
  timeLabel,
  dateLabel,
}: AodMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").ImageOverlay | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(opacity);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ─── Initialize Map ─────────────────────────────────────────────────────
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
        maxZoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      if (isCancelled) {
        map.remove();
        return;
      }

      // Dark basemap (no labels) — goes under AOD overlay
      L.tileLayer(DARK_TILE_URL, {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Labels — go on top of AOD overlay
      const labelsPane = map.createPane("labels");
      labelsPane.style.zIndex = "650";
      labelsPane.style.pointerEvents = "none";

      L.tileLayer(LABELS_TILE_URL, {
        maxZoom: 19,
        subdomains: "abcd",
        pane: "labels",
      }).addTo(map);

      // Zoom control — bottom right, Apple style
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Track mouse position
      map.on("mousemove", (e: import("leaflet").LeafletMouseEvent) => {
        setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.on("mouseout", () => setCursorCoords(null));

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

  // ─── AOD Image Overlay ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const leaflet = L;

    // Remove old overlay
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    setImageLoaded(false);
    setImageError(false);

    if (!imageUrl) return;

    // Preload the image to check it works
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!mapInstanceRef.current) return;

      const overlay = leaflet.imageOverlay(imageUrl, AOD_BOUNDS, {
        opacity: overlayOpacity,
        interactive: false,
        zIndex: 400,
      });
      overlay.addTo(map);
      overlayRef.current = overlay;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageError(true);
    };
    img.src = imageUrl;

    return () => {
      if (overlayRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [imageUrl, mapReady, overlayOpacity]);

  // ─── Update opacity dynamically ────────────────────────────────────────
  const handleOpacityChange = useCallback((val: number) => {
    setOverlayOpacity(val);
    if (overlayRef.current) {
      overlayRef.current.setOpacity(val);
    }
  }, []);

  // ─── Get region name from coordinates ──────────────────────────────────
  function getRegionName(lat: number, lng: number): string {
    // Major Indian cities / regions for hover context
    const regions: { name: string; lat: number; lng: number; radius: number }[] = [
      { name: "Delhi NCR", lat: 28.61, lng: 77.21, radius: 0.8 },
      { name: "Mumbai", lat: 19.08, lng: 72.88, radius: 0.6 },
      { name: "Kolkata", lat: 22.57, lng: 88.36, radius: 0.6 },
      { name: "Chennai", lat: 13.08, lng: 80.27, radius: 0.6 },
      { name: "Bengaluru", lat: 12.97, lng: 77.59, radius: 0.6 },
      { name: "Hyderabad", lat: 17.39, lng: 78.49, radius: 0.6 },
      { name: "Ahmedabad", lat: 23.02, lng: 72.57, radius: 0.5 },
      { name: "Pune", lat: 18.52, lng: 73.86, radius: 0.5 },
      { name: "Jaipur", lat: 26.91, lng: 75.79, radius: 0.5 },
      { name: "Lucknow", lat: 26.85, lng: 80.95, radius: 0.5 },
      { name: "Chandigarh", lat: 30.73, lng: 76.78, radius: 0.4 },
      { name: "Bhopal", lat: 23.26, lng: 77.41, radius: 0.5 },
      { name: "Patna", lat: 25.61, lng: 85.14, radius: 0.5 },
      { name: "Guwahati", lat: 26.14, lng: 91.74, radius: 0.5 },
      { name: "Thiruvananthapuram", lat: 8.52, lng: 76.94, radius: 0.5 },
      { name: "Varanasi", lat: 25.32, lng: 83.01, radius: 0.4 },
      { name: "Amritsar", lat: 31.63, lng: 74.87, radius: 0.4 },
      { name: "Nagpur", lat: 21.15, lng: 79.09, radius: 0.5 },
      { name: "Indore", lat: 22.72, lng: 75.86, radius: 0.4 },
      { name: "Visakhapatnam", lat: 17.69, lng: 83.22, radius: 0.4 },
      { name: "Kochi", lat: 9.93, lng: 76.27, radius: 0.4 },
      { name: "Srinagar", lat: 34.08, lng: 74.80, radius: 0.4 },
      { name: "Dehradun", lat: 30.32, lng: 78.03, radius: 0.4 },
      { name: "Raipur", lat: 21.25, lng: 81.63, radius: 0.4 },
      { name: "Ranchi", lat: 23.34, lng: 85.31, radius: 0.4 },
      { name: "Goa", lat: 15.50, lng: 73.83, radius: 0.4 },
      { name: "Indo-Gangetic Plain", lat: 27.0, lng: 80.0, radius: 3.0 },
      { name: "Thar Desert", lat: 26.5, lng: 71.0, radius: 2.0 },
      { name: "Western Ghats", lat: 14.0, lng: 75.0, radius: 2.0 },
      { name: "Bay of Bengal", lat: 15.0, lng: 85.0, radius: 4.0 },
      { name: "Arabian Sea", lat: 15.0, lng: 68.0, radius: 4.0 },
    ];

    // Find closest city within radius
    for (const r of regions) {
      const d = Math.sqrt((lat - r.lat) ** 2 + (lng - r.lng) ** 2);
      if (d <= r.radius) return r.name;
    }

    // Broad region check
    if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) return "India";
    if (lat >= -10 && lat <= 40 && lng >= 55 && lng <= 100) return "South Asia";
    return "";
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
      {/* Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      />

      {/* Loading state */}
      {!imageLoaded && !imageError && imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 800,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderRadius: "12px",
              backgroundColor: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid rgba(255,255,255,0.15)",
                borderTop: "2px solid #2997ff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            Loading AOD overlay…
          </div>
        </div>
      )}

      {/* Error state */}
      {imageError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 800,
            padding: "16px 24px",
            borderRadius: "12px",
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(10px)",
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            maxWidth: "280px",
          }}
        >
          <div style={{ marginBottom: "4px", color: "#ff9f0a", fontWeight: 600 }}>
            AOD not available
          </div>
          <div style={{ fontSize: "11px" }}>
            Aerosol Optical Depth is a Level-2 product generated during daytime hours only.
            Data is typically available from ~11:00 AM IST.
          </div>
        </div>
      )}

      {/* ── Top-Left: Data Source Badge ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 800,
          padding: "8px 12px",
          borderRadius: "10px",
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "11px",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: imageLoaded ? "#30d158" : "#ff9f0a",
          }}
        />
        <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
          INSAT-3DS · L2G AOD
        </span>
        {timeLabel && (
          <>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span style={{ color: "#2997ff", fontWeight: 600 }}>{timeLabel}</span>
          </>
        )}
        {dateLabel && (
          <span style={{ color: "rgba(255,255,255,0.35)" }}>{dateLabel}</span>
        )}
      </div>

      {/* ── Top-Right: Opacity Slider ── */}
      {imageLoaded && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 800,
            padding: "8px 14px",
            borderRadius: "10px",
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Overlay
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(overlayOpacity * 100)}
            onChange={(e) => handleOpacityChange(Number(e.target.value) / 100)}
            style={{
              width: "80px",
              accentColor: "#2997ff",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: 600, minWidth: "30px", textAlign: "right" }}>
            {Math.round(overlayOpacity * 100)}%
          </span>
        </div>
      )}

      {/* ── Bottom-Left: Cursor Coordinates + Region ── */}
      {cursorCoords && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            zIndex: 800,
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "11px",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "SF Mono, Monaco, monospace" }}>
            {cursorCoords.lat.toFixed(2)}°N, {cursorCoords.lng.toFixed(2)}°E
          </span>
          {(() => {
            const regionName = getRegionName(cursorCoords.lat, cursorCoords.lng);
            return regionName ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                <span style={{ color: "#2997ff", fontWeight: 600 }}>{regionName}</span>
              </>
            ) : null;
          })()}
        </div>
      )}

      {/* ── Bottom-Right: AOD Color Legend ── */}
      {imageLoaded && (
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            right: "12px",
            zIndex: 800,
            padding: "10px 12px",
            borderRadius: "10px",
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "6px",
            }}
          >
            AOD Scale
          </div>
          {AOD_LEGEND.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "2px",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: item.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", minWidth: "50px" }}>
                {item.label}
              </span>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
