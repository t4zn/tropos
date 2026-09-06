"use client";

import { Suspense, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCorridorData } from "@/hooks/useCorridorData";
import { computeAttribution, type AttributionResult } from "@/lib/attribution";
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

  const highestAqiStation = useMemo(
    () => stations.reduce<CorridorStation | null>((highest, station) => (!highest || station.aqi > highest.aqi ? station : highest), null),
    [stations]
  );

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ??
    stations.find((station) => station.id === stationIdFromUrl) ??
    highestAqiStation;

  const result: AttributionResult | null = useMemo(() => {
    if (!selectedStation) return null;

    return computeAttribution(
      selectedStation.lat,
      selectedStation.lng,
      selectedStation.windSpeed || wind?.speed || 0,
      selectedStation.windDeg || wind?.deg || 0,
      lookbackHours,
      selectedStation.pm25,
      selectedStation.boundaryLayerHeight
    );
  }, [lookbackHours, selectedStation, wind]);

  const handleSelectStation = (station: CorridorStation | null) => {
    setSelectedStationId(station?.id ?? null);
  };

  const topCandidate = result?.ranked[0] ?? null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navigation />
      <main style={{ flex: 1 }}>
        <section className="product-tile-light">
          <div className="container">
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 360px" }}>
                <span style={{ color: "var(--color-primary)", fontSize: 14, fontWeight: 600 }}>INVESTIGATION SUPPORT</span>
                <h1 className="hero-display">Source Attribution</h1>
                <p className="lead" style={{ color: "var(--color-ink-muted-48)" }}>
                  A live-data back-trajectory screen that identifies an upwind investigation area, not a confirmed emitter.
                </p>

                {error && !isLoading ? (
                  <div role="alert" className="store-utility-card" style={{ marginTop: 18 }}>
                    Live corridor data is unavailable. Attribution is paused until a current observation can be loaded.
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 18 }}>
                      <label htmlFor="lookback-hours" style={{ display: "block", marginBottom: 8 }}>
                        Lookback window: {lookbackHours} hours
                      </label>
                      <input
                        id="lookback-hours"
                        type="range"
                        min={1}
                        max={6}
                        value={lookbackHours}
                        onChange={(event) => setLookbackHours(Number(event.target.value))}
                      />
                    </div>

                    <div style={{ marginTop: 18, padding: 12, border: "1px solid #eaeaea", borderRadius: 8 }}>
                      {isLoading ? (
                        "Loading live corridor observation…"
                      ) : selectedStation ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedStation.name}</div>
                          <div style={{ color: "#7a7a7a", marginTop: 6 }}>
                            PM2.5: {selectedStation.pm25} µg/m³ · AQI: {selectedStation.aqi} · observed {selectedStation.observationTime ? new Date(selectedStation.observationTime).toLocaleString("en-IN") : "time unavailable"}
                          </div>
                        </>
                      ) : (
                        "No live station is available."
                      )}
                    </div>

                    {topCandidate && (
                      <div className="store-utility-card" style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 12, color: "#0066cc", fontWeight: 600 }}>UPWIND INVESTIGATION CANDIDATE</div>
                        <h3 style={{ marginTop: 6 }}>{topCandidate.name}</h3>
                        <div style={{ color: "#7a7a7a", marginTop: 8 }}>
                          Distance: {topCandidate.distanceKm} km · Bearing: {topCandidate.bearingDeg}°
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{Math.round(topCandidate.score * 100)}% model score</div>
                        <p style={{ marginTop: 8, color: "#7a7a7a", fontSize: 13 }}>
                          This score is a prototype screening signal. It is not evidence of responsibility and must be validated with an emissions inventory and a scientific dispersion model.
                        </p>
                        {topCandidate.reasons.length > 0 && (
                          <ul>
                            {topCandidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ width: "min(520px, 100%)", height: 520 }}>
                <CorridorMap
                  stations={stations}
                  selectedStation={selectedStation ?? null}
                  onSelectStation={handleSelectStation}
                  particlePaths={result?.particlePaths}
                  envelope={result?.envelope}
                  candidates={result?.ranked.map((candidate) => ({ id: candidate.id, name: candidate.name, lat: candidate.lat, lng: candidate.lng }))}
                  highlightedSourceId={null}
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
