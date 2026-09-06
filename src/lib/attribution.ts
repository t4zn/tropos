import { CORRIDOR_STATIONS } from "@/data/airData";

export interface ParticlePoint {
  lat: number;
  lng: number;
  tHours: number; // hours back
}

export interface CandidateScore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number; // 0-1
  distanceKm: number;
  bearingDeg: number;
  reasons: string[];
}

export interface AttributionResult {
  particlePaths: ParticlePoint[][];
  envelope: Array<{ lat: number; lng: number }>;
  ranked: CandidateScore[];
}

function deg2rad(d: number) { return (d * Math.PI) / 180; }
function rad2deg(r: number) { return (r * 180) / Math.PI; }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function bearingDeg(lat1:number, lon1:number, lat2:number, lon2:number){
  const y = Math.sin(deg2rad(lon2-lon1)) * Math.cos(deg2rad(lat2));
  const x = Math.cos(deg2rad(lat1))*Math.sin(deg2rad(lat2)) - Math.sin(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.cos(deg2rad(lon2-lon1));
  return (rad2deg(Math.atan2(y,x)) + 360) % 360;
}

// Deterministic PRNG utilities (seeded by receptor + params)
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(seedStr: string) {
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

/**
 * Generate backward particle trajectories from a receptor
 */
export function computeParticles(
  receptorLat: number,
  receptorLng: number,
  windSpeedKmh: number,
  windBearingDeg: number,
  hoursBack: number = 3,
  nParticles: number = 36,
  stepMinutes: number = 15
) : ParticlePoint[][] {
  const particles: ParticlePoint[][] = [];
  const steps = Math.max(1, Math.ceil((hoursBack * 60) / stepMinutes));

  // deterministic RNG seeded by geometric and temporal inputs
  const rng = seededRng(`${receptorLat.toFixed(6)},${receptorLng.toFixed(6)},${windBearingDeg},${hoursBack}`);

  // upwind bearing is windBearingDeg (wind FROM); move along that bearing for backward path
  const upwindBearing = windBearingDeg;

  for (let p = 0; p < nParticles; p++) {
    const path: ParticlePoint[] = [];
    // lateral deterministic offset factor per particle
    const lateralSign = (p % 2 === 0) ? 1 : -1;
    const lateralScale = (Math.floor(p/2) + 1) * 0.2; // km baseline

    for (let s = 0; s <= steps; s++) {
      const tHours = (s * stepMinutes) / 60;
      const distanceKm = windSpeedKmh * tHours;
      // small deterministic radial jitter to simulate turbulence
      const jitterKm = (rng() - 0.5) * 0.15 * Math.sqrt(tHours + 0.1);
      // lateral offset increases with sqrt(time)
      const lateralKm = lateralScale * Math.sqrt(tHours + 0.1) * (rng() * 0.6 + 0.7) * lateralSign;

      // compute displacement along bearing
      const bearingRad = deg2rad(upwindBearing);
      const deltaLat = (distanceKm * Math.cos(bearingRad)) / 111;
      const deltaLng = (distanceKm * Math.sin(bearingRad)) / (111 * Math.cos(deg2rad(receptorLat)));

      // apply lateral perpendicular offset
      const perpBearingRad = bearingRad + Math.PI/2;
      const perpLat = (lateralKm * Math.cos(perpBearingRad)) / 111;
      const perpLng = (lateralKm * Math.sin(perpBearingRad)) / (111 * Math.cos(deg2rad(receptorLat)));

      const lat = receptorLat + deltaLat + perpLat + (jitterKm/111);
      const lng = receptorLng + deltaLng + perpLng + (jitterKm/(111 * Math.cos(deg2rad(receptorLat))));

      path.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), tHours });
    }

    particles.push(path);
  }

  return particles;
}

/**
 * Build a simple envelope polygon from particle endpoints
 */
export function buildEnvelope(particles: ParticlePoint[][]) : Array<{lat:number,lng:number}> {
  // Use final point of each particle
  const ends = particles.map(p => p[p.length-1]);
  // centroid
  const cx = ends.reduce((s, e) => s + e.lat, 0) / ends.length;
  const cy = ends.reduce((s, e) => s + e.lng, 0) / ends.length;

  // sort ends by angle around centroid
  const sorted = ends.slice().sort((a,b)=> Math.atan2(a.lat-cx, a.lng-cy) - Math.atan2(b.lat-cx, b.lng-cy));
  return sorted.map(e=>({lat:e.lat,lng:e.lng}));
}

/**
 * Compute attribution scores against candidate sources.
 * Candidates: array of {id,name,lat,lng}
 */
export function scoreCandidates(
  receptorLat:number,
  receptorLng:number,
  particles: ParticlePoint[][],
  candidates: Array<{ id:string; name:string; lat:number; lng:number }>,
  pm25:number,
  boundaryLayerM:number,
  windBearingDeg:number
) : CandidateScore[] {
  // derive mean endpoint (expected source location)
  const endpoints = particles.map(p => p[p.length-1]);
  const meanLat = endpoints.reduce((s,e)=>s+e.lat,0)/endpoints.length;
  const meanLng = endpoints.reduce((s,e)=>s+e.lng,0)/endpoints.length;

  const maxDist = Math.max(...endpoints.map(e => haversineKm(receptorLat, receptorLng, e.lat, e.lng)), 1);

  const scores: CandidateScore[] = candidates.map(cand => {
    const distToMean = haversineKm(cand.lat, cand.lng, meanLat, meanLng);
    const distToReceptor = haversineKm(cand.lat, cand.lng, receptorLat, receptorLng);
    const bearing = bearingDeg(receptorLat, receptorLng, cand.lat, cand.lng);
    const angularDiff = Math.abs(((bearing - windBearingDeg + 540) % 360) - 180); // 0 good
    const alignmentScore = Math.max(0, 1 - (angularDiff / 180));
    const proximityScore = Math.max(0, 1 - distToMean / Math.max(maxDist, 5));
    const severityScore = Math.min(1, pm25 / 500);
    const blhScore = Math.max(0, Math.min(1, (500 - boundaryLayerM) / 500));

    // weights
    const wAlign = 0.45;
    const wProx = 0.3;
    const wSev = 0.15;
    const wBlh = 0.1;

    const score = Math.max(0, Math.min(1, wAlign*alignmentScore + wProx*proximityScore + wSev*severityScore + wBlh*blhScore));

    const reasons: string[] = [];
    if (alignmentScore > 0.7) reasons.push("Strong upwind alignment");
    if (proximityScore > 0.6) reasons.push("Trajectory intersects source zone");
    if (severityScore > 0.6) reasons.push("Severe PM2.5 event at receptor");
    if (blhScore > 0.5) reasons.push("Stable/low boundary-layer aids surface trapping");

    return {
      id: cand.id,
      name: cand.name,
      lat: cand.lat,
      lng: cand.lng,
      score: Number(score.toFixed(3)),
      distanceKm: Number(distToReceptor.toFixed(2)),
      bearingDeg: Math.round(bearing),
      reasons,
    };
  });

  scores.sort((a,b)=>b.score - a.score);
  return scores;
}

/**
 * High-level compute attribution using existing corridor candidate list
 */
export function computeAttribution(
  receptorLat:number,
  receptorLng:number,
  windSpeedKmh:number,
  windBearingDeg:number,
  hoursBack:number,
  pm25:number,
  boundaryLayerM:number
) : AttributionResult {
  const particles = computeParticles(receptorLat, receptorLng, windSpeedKmh, windBearingDeg, hoursBack, 36, 15);
  const envelope = buildEnvelope(particles);

  // collect candidates from CORRIDOR_STATIONS attributedSource entries
  const candidatesRaw = CORRIDOR_STATIONS
    .filter(s => s.attributedSource)
    .map(s => ({ id: s.id, name: s.attributedSource!.clusterName, lat: s.attributedSource!.coordinates.lat, lng: s.attributedSource!.coordinates.lng }));

  const ranked = scoreCandidates(receptorLat, receptorLng, particles, candidatesRaw, pm25, boundaryLayerM, windBearingDeg);

  return { particlePaths: particles, envelope, ranked };
}
