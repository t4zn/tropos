export interface CandidateScore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  distanceKm: number;
  bearingDeg: number;
  reasons: string[];
  typeLabel?: string;
  area?: string;
  state?: string;
  osmSource?: string;
}

export interface AttributionResult {
  particlePaths: Array<Array<{ lat:number; lng:number; tHours:number }>>;
  envelope: Array<{ lat:number; lng:number }>;
  ranked: CandidateScore[];
}
