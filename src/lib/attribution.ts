import { CORRIDOR_STATIONS } from "@/data/airData";
import { INDUSTRIAL_CLUSTERS, IndustrialCluster } from "@/data/industrialRegistry";

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
  typeLabel?: string;
  area?: string;
  state?: string;
  osmSource?: string;
}

export interface AttributionResult {
  particlePaths: ParticlePoint[][];
  envelope: Array<{ lat: number; lng: number }>;
  ranked: CandidateScore[];
  isKinematic?: boolean;
  sourceCount?: number;
}

export interface HourlyWindVector {
  hoursAgo: number;
  windSpeedKmh: number;
  windDeg: number;
  boundaryLayerHeight?: number;
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
 * Interpolate wind vector at a given hoursBack from historical hourly observations
 */
function getWindAtTime(
  hoursBack: number,
  hourlyWinds: HourlyWindVector[],
  defaultSpeed: number,
  defaultDeg: number
): { speed: number; deg: number } {
  if (!hourlyWinds || hourlyWinds.length === 0) {
    return { speed: defaultSpeed, deg: defaultDeg };
  }

  // Find closest past hour entry
  const sorted = [...hourlyWinds].sort((a, b) => Math.abs(a.hoursAgo - hoursBack) - Math.abs(b.hoursAgo - hoursBack));
  const closest = sorted[0];

  return {
    speed: closest?.windSpeedKmh ?? defaultSpeed,
    deg: closest?.windDeg ?? defaultDeg,
  };
}

/**
 * Generate backward particle trajectories from a receptor using kinematic hourly wind vectors.
 * As wind direction changes over time, trajectories curve authentically!
 */
export function computeKinematicParticles(
  receptorLat: number,
  receptorLng: number,
  hourlyWinds: HourlyWindVector[],
  fallbackSpeedKmh: number,
  fallbackBearingDeg: number,
  hoursBack: number = 3,
  nParticles: number = 36,
  stepMinutes: number = 10
): ParticlePoint[][] {
  const particles: ParticlePoint[][] = [];
  const steps = Math.max(1, Math.ceil((hoursBack * 60) / stepMinutes));
  const dtHours = stepMinutes / 60;

  // Seeded PRNG for reproducible, deterministic turbulence
  const baseDeg = hourlyWinds?.[0]?.windDeg ?? fallbackBearingDeg;
  const rng = seededRng(`${receptorLat.toFixed(4)},${receptorLng.toFixed(4)},${baseDeg},${hoursBack}`);

  for (let p = 0; p < nParticles; p++) {
    const path: ParticlePoint[] = [];
    let currentLat = receptorLat;
    let currentLng = receptorLng;

    // Start with receptor point at t = 0
    path.push({ lat: Number(currentLat.toFixed(6)), lng: Number(currentLng.toFixed(6)), tHours: 0 });

    const lateralSign = (p % 2 === 0) ? 1 : -1;
    const lateralScale = (Math.floor(p / 2) + 1) * 0.15;

    for (let s = 1; s <= steps; s++) {
      const tHours = s * dtHours;

      // Get real historical wind at this lookback time
      const wind = getWindAtTime(tHours, hourlyWinds, fallbackSpeedKmh, fallbackBearingDeg);
      const windSpeedKmh = Math.max(1.0, wind.speed);
      // Wind comes FROM wind.deg, so backward trajectory moves TOWARD wind.deg
      const upwindBearing = wind.deg;

      // Distance traveled in this time step (km)
      const stepDistKm = windSpeedKmh * dtHours;

      // Small turbulence jitter
      const jitterKm = (rng() - 0.5) * 0.08 * Math.sqrt(tHours);
      const lateralKm = lateralScale * Math.sqrt(tHours) * (rng() * 0.4 + 0.8) * lateralSign * dtHours;

      // Displace along upwind bearing
      const bearingRad = deg2rad(upwindBearing);
      const deltaLat = (stepDistKm * Math.cos(bearingRad)) / 111;
      const deltaLng = (stepDistKm * Math.sin(bearingRad)) / (111 * Math.cos(deg2rad(currentLat)));

      // Perpendicular lateral dispersion
      const perpRad = bearingRad + Math.PI / 2;
      const perpLat = (lateralKm * Math.cos(perpRad)) / 111;
      const perpLng = (lateralKm * Math.sin(perpRad)) / (111 * Math.cos(deg2rad(currentLat)));

      currentLat += deltaLat + perpLat + (jitterKm / 111);
      currentLng += deltaLng + perpLng + (jitterKm / (111 * Math.cos(deg2rad(currentLat))));

      path.push({
        lat: Number(currentLat.toFixed(6)),
        lng: Number(currentLng.toFixed(6)),
        tHours: Number(tHours.toFixed(2)),
      });
    }

    particles.push(path);
  }

  return particles;
}

/**
 * Backward particle generator using static wind vector (backward compatibility)
 */
export function computeParticles(
  receptorLat: number,
  receptorLng: number,
  windSpeedKmh: number,
  windBearingDeg: number,
  hoursBack: number = 3,
  nParticles: number = 36,
  stepMinutes: number = 15
): ParticlePoint[][] {
  return computeKinematicParticles(
    receptorLat,
    receptorLng,
    [],
    windSpeedKmh,
    windBearingDeg,
    hoursBack,
    nParticles,
    stepMinutes
  );
}

/**
 * Build a convex envelope polygon around all particle trajectory points
 */
export function buildEnvelope(particles: ParticlePoint[][]): Array<{ lat: number; lng: number }> {
  const ends = particles.map((p) => p[p.length - 1]);
  if (ends.length === 0) return [];

  const cx = ends.reduce((s, e) => s + e.lat, 0) / ends.length;
  const cy = ends.reduce((s, e) => s + e.lng, 0) / ends.length;

  const sorted = ends.slice().sort((a, b) => Math.atan2(a.lat - cx, a.lng - cy) - Math.atan2(b.lat - cx, b.lng - cy));
  return sorted.map((e) => ({ lat: e.lat, lng: e.lng }));
}

/**
 * Compute attribution scores against candidate sources with full industrial metadata
 */
export function scoreCandidates(
  receptorLat: number,
  receptorLng: number,
  particles: ParticlePoint[][],
  candidates: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    typeLabel?: string;
    area?: string;
    state?: string;
    osmSource?: string;
  }>,
  pm25: number,
  boundaryLayerM: number,
  windBearingDeg: number
): CandidateScore[] {
  const endpoints = particles.map((p) => p[p.length - 1]);
  if (endpoints.length === 0 || candidates.length === 0) return [];

  const meanLat = endpoints.reduce((s, e) => s + e.lat, 0) / endpoints.length;
  const meanLng = endpoints.reduce((s, e) => s + e.lng, 0) / endpoints.length;

  const maxDist = Math.max(...endpoints.map((e) => haversineKm(receptorLat, receptorLng, e.lat, e.lng)), 1);

  const scores: CandidateScore[] = candidates.map((cand) => {
    const distToMean = haversineKm(cand.lat, cand.lng, meanLat, meanLng);
    const distToReceptor = haversineKm(cand.lat, cand.lng, receptorLat, receptorLng);
    const bearing = bearingDeg(receptorLat, receptorLng, cand.lat, cand.lng);
    const angularDiff = Math.abs(((bearing - windBearingDeg + 540) % 360) - 180);
    const alignmentScore = Math.max(0, 1 - angularDiff / 180);
    const proximityScore = Math.max(0, 1 - distToMean / Math.max(maxDist, 8));
    const severityScore = Math.min(1, pm25 / 400);
    const blhScore = Math.max(0, Math.min(1, (600 - boundaryLayerM) / 600));

    // Attribution weights (Physics-informed)
    const wAlign = 0.45;
    const wProx = 0.30;
    const wSev = 0.15;
    const wBlh = 0.10;

    const score = Math.max(0, Math.min(1, wAlign * alignmentScore + wProx * proximityScore + wSev * severityScore + wBlh * blhScore));

    const reasons: string[] = [];
    if (alignmentScore > 0.75) reasons.push("Direct upwind trajectory corridor alignment");
    else if (alignmentScore > 0.55) reasons.push("Moderate upwind trajectory alignment");

    if (proximityScore > 0.7) reasons.push("Plume centroid directly intersects industrial zone");
    else if (distToReceptor < 15) reasons.push(`Close geographic proximity (${distToReceptor.toFixed(1)} km)`);

    if (severityScore > 0.6) reasons.push(`Severe PM2.5 event at receptor (${pm25} µg/m³)`);
    if (blhScore > 0.5) reasons.push(`Low boundary layer (${boundaryLayerM}m) promotes surface ground trapping`);

    return {
      id: cand.id,
      name: cand.name,
      lat: cand.lat,
      lng: cand.lng,
      score: Number(score.toFixed(3)),
      distanceKm: Number(distToReceptor.toFixed(1)),
      bearingDeg: Math.round(bearing),
      reasons,
      typeLabel: cand.typeLabel,
      area: cand.area,
      state: cand.state,
      osmSource: cand.osmSource,
    };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

/**
 * Real-Data Attribution Engine
 * Ingests real OpenStreetMap industrial clusters & real hourly kinematic wind history.
 */
export function computeRealAttribution(
  receptorLat: number,
  receptorLng: number,
  hourlyWinds: HourlyWindVector[],
  windSpeedKmh: number,
  windBearingDeg: number,
  hoursBack: number,
  pm25: number,
  boundaryLayerM: number
): AttributionResult {
  const isKinematic = hourlyWinds && hourlyWinds.length > 0;

  // 1. Compute kinematic particles with curved back-trajectory
  const particles = computeKinematicParticles(
    receptorLat,
    receptorLng,
    hourlyWinds,
    windSpeedKmh,
    windBearingDeg,
    hoursBack,
    36,
    10
  );

  // 2. Build convex envelope around dispersion cloud
  const envelope = buildEnvelope(particles);

  // 3. Spatially prune: gather real industrial clusters within corridor reach
  // Calculate bounding box of particle endpoints with 15km buffer
  const lats = particles.flatMap((p) => p.map((pt) => pt.lat));
  const lngs = particles.flatMap((p) => p.map((pt) => pt.lng));
  const minLat = Math.min(...lats) - 0.15;
  const maxLat = Math.max(...lats) + 0.15;
  const minLng = Math.min(...lngs) - 0.15;
  const maxLng = Math.max(...lngs) + 0.15;

  const relevantClusters = INDUSTRIAL_CLUSTERS.filter(
    (c) => c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng
  );

  // If spatial pruning is too tight, fallback to all clusters within 45km
  const candidatePool = relevantClusters.length >= 3
    ? relevantClusters
    : INDUSTRIAL_CLUSTERS.filter((c) => haversineKm(receptorLat, receptorLng, c.lat, c.lng) <= 50);

  const candidatesFormatted = candidatePool.map((c) => ({
    id: c.id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    typeLabel: c.typeLabel,
    area: c.area,
    state: c.state,
    osmSource: c.osmSource,
  }));

  // Effective bearing (most recent wind or dominant wind)
  const effectiveBearing = hourlyWinds?.[0]?.windDeg ?? windBearingDeg;

  // 4. Score all candidate industrial estates
  const ranked = scoreCandidates(
    receptorLat,
    receptorLng,
    particles,
    candidatesFormatted,
    pm25,
    boundaryLayerM,
    effectiveBearing
  );

  return {
    particlePaths: particles,
    envelope,
    ranked,
    isKinematic,
    sourceCount: candidatesFormatted.length,
  };
}

/**
 * Deprecated fallback for backward compatibility
 */
export function computeAttribution(
  receptorLat: number,
  receptorLng: number,
  windSpeedKmh: number,
  windBearingDeg: number,
  hoursBack: number,
  pm25: number,
  boundaryLayerM: number
): AttributionResult {
  return computeRealAttribution(
    receptorLat,
    receptorLng,
    [],
    windSpeedKmh,
    windBearingDeg,
    hoursBack,
    pm25,
    boundaryLayerM
  );
}

