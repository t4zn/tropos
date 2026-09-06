"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCorridorData } from "@/hooks/useCorridorData";
import { computeAttribution } from "@/lib/attribution";

const CorridorMap = dynamic(() => import("@/components/CorridorMap"), { ssr: false });

export default function AttributionPage() {
  const searchParams = useSearchParams();
  const stationId = searchParams?.get("station") ?? null;
  const { stations, wind, isLoading } = useCorridorData();

  const [lookbackHours, setLookbackHours] = useState<number>(3);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [autoRunningMessage, setAutoRunningMessage] = useState<string>("");

  // if a station id is provided in URL, initialize selection
  useEffect(()=>{
    if (stationId && stations && stations.length>0) {
      const s = stations.find((st)=>st.id===stationId);
      if (s) setSelectedStation(s);
    }
  }, [stationId, stations]);

  // Auto-select first severe/highest-AQI station when none selected
  useEffect(()=>{
    if (selectedStation) return;
    if (!stations || stations.length === 0) return;
    // if stationId provided, don't override
    if (stationId) return;

    const sorted = stations.slice().sort((a,b)=> (b.aqi ?? 0) - (a.aqi ?? 0));
    const severe = sorted.find(s=> (s.aqi ?? 0) >= 200) || sorted[0];
    if (severe) {
      try { console.log('[AttributionPage] auto-select station', severe.id, severe.name, 'AQI', severe.aqi); } catch(e){}
      setSelectedStation(severe);
      setAutoRunningMessage(`Auto-selecting ${severe.name} (AQI ${severe.aqi}) and running attribution`);
      setTimeout(()=>setAutoRunningMessage(''), 4000);
    }
  }, [stations, stationId, selectedStation]);

  const receptor = selectedStation ?? (stations.find((s) => s.id === stationId) ?? null);

  useEffect(() => {
    async function run() {
      if (!receptor) return;
      setLoading(true);
      const windSpeed = (receptor as any).windSpeed ?? (wind?.speed ?? 5);
      const windDeg = (receptor as any).windDeg ?? (wind?.deg ?? 270);
      const hours = lookbackHours;
      const pm25 = (receptor as any).pm25 ?? 0;
      const blh = (receptor as any).boundaryLayerHeight ?? (receptor as any).boundaryLayerHeightM ?? 500;

      try {
        console.log('[AttributionPage] running computeAttribution', { id: receptor.id, name: receptor.name, lat: (receptor as any).lat || (receptor as any).coordinates?.lat, lng: (receptor as any).lng || (receptor as any).coordinates?.lng, windSpeed, windDeg, hours, pm25, blh });
      } catch(e){}

      const r = computeAttribution((receptor as any).lat || (receptor as any).coordinates?.lat, (receptor as any).lng || (receptor as any).coordinates?.lng, windSpeed, windDeg, hours, pm25, blh);
      try { console.log('[AttributionPage] computeAttribution result top', r?.ranked?.[0]); } catch(e){}
      setResult(r);
      setLoading(false);
    }
    run();
  }, [receptor, lookbackHours, wind]);

  // allow manual rerun via button
  function runNow() {
    if (!receptor) return;
    setLoading(true);
    const windSpeed = (receptor as any).windSpeed ?? (wind?.speed ?? 5);
    const windDeg = (receptor as any).windDeg ?? (wind?.deg ?? 270);
    const hours = lookbackHours;
    const pm25 = (receptor as any).pm25 ?? 0;
    const blh = (receptor as any).boundaryLayerHeight ?? (receptor as any).boundaryLayerHeightM ?? 500;
    try { console.log('[AttributionPage] manual run', { id: receptor.id, windSpeed, windDeg, hours, pm25, blh }); } catch(e){}
    const r = computeAttribution((receptor as any).lat || (receptor as any).coordinates?.lat, (receptor as any).lng || (receptor as any).coordinates?.lng, windSpeed, windDeg, hours, pm25, blh);
    try { console.log('[AttributionPage] manual result top', r?.ranked?.[0]); } catch(e){}
    setResult(r);
    setLoading(false);
  }

  // helper: select station and immediately run attribution
  function selectStationAndRun(station:any) {
    try { console.log('[AttributionPage] selectStationAndRun', station?.id, station?.name); } catch(e){}
    setSelectedStation(station);
    // small delay to ensure state updates propagate before run
    setTimeout(()=>{
      try { runNow(); } catch(e){}
    }, 30);
  }

  useEffect(()=>{
    if (!selectedStation) return;
    try { console.log('[AttributionPage] selectedStation changed', selectedStation.id); } catch(e){}
  }, [selectedStation]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navigation />

      <main style={{ flex: 1 }}>
        <section className="product-tile-light">
          <div className="container">
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h1 className="hero-display">Source Attribution</h1>
                <p className="lead" style={{ color: "var(--color-ink-muted-48)" }}>
                  Select a hotspot on the map or open this page with a station query parameter to
                  run a deterministic backward trajectory attribution.
                </p>

                <div style={{ marginTop: 18 }}>
                  <label style={{ display: "block", marginBottom: 8 }}>Lookback hours: {lookbackHours}</label>
                  <input type="range" min={1} max={6} value={lookbackHours} onChange={(e)=>setLookbackHours(Number(e.target.value))} />
                </div>

                <div style={{ marginTop: 18 }}>
                  {receptor ? (
                    <div style={{ padding: 12, border: "1px solid #eaeaea", borderRadius: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{(receptor as any).name || (receptor as any).coordinates?.lat}</div>
                      <div style={{ color: "#7a7a7a", marginTop: 6 }}>PM2.5: {(receptor as any).pm25} µg/m³ · AQI: {(receptor as any).aqi}</div>
                    </div>
                  ) : (
                    <div style={{ color: "#7a7a7a" }}>No station selected. Open from the corridor map or provide ?station=ID</div>
                  )}
                </div>

                <div style={{ marginTop: 18 }}>
                  <button
                    disabled={!receptor || loading}
                    onClick={() => { runNow(); }}
                    className="button-primary"
                  >
                    {loading ? "Tracing…" : "Investigate Hotspot"}
                  </button>
                  {autoRunningMessage && (<div style={{ marginTop: 8, fontSize: 13, color: '#0066cc' }}>{autoRunningMessage}</div>)}
                </div>

                <div style={{ marginTop: 20 }}>
                  {result && result.ranked && result.ranked.length > 0 && (
                    <div className="store-utility-card">
                      <div style={{ fontSize: 12, color: "#0066cc", fontWeight: 600 }}>PROBABLE SOURCE IDENTIFIED</div>
                      <h3 style={{ marginTop: 6 }}>{result.ranked[0].name}</h3>
                      <div style={{ color: "#7a7a7a", marginTop: 8 }}>Distance: {result.ranked[0].distanceKm} km · Bearing: {result.ranked[0].bearingDeg}°</div>
                      <div style={{ marginTop: 8, fontWeight: 700 }}>{Math.round(result.ranked[0].score*100)}% attribution confidence</div>
                      <div style={{ marginTop: 8 }}>
                        <ul>
                          {result.ranked[0].reasons.map((r:string,i:number)=>(<li key={i}>{r}</li>))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ width: 520, height: 520 }}>
                <div style={{ width: "100%", height: "100%" }}>
                  <CorridorMap
                    stations={stations}
                    selectedStation={selectedStation}
                    onSelectStation={setSelectedStation}
                    particlePaths={result?.particlePaths}
                    envelope={result?.envelope}
                    candidates={result?.ranked?.map((c:any)=>({id:c.id,name:c.name,lat:c.lat,lng:c.lng}))}
                    highlightedSourceId={result?.ranked?.[0]?.id ?? null}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
