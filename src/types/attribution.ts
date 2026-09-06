export interface CandidateScore {
  id: string;
  name: string;
  score: number;
  distanceKm: number;
  bearingDeg: number;
  reasons: string[];
}

export interface AttributionResult {
  particlePaths: Array<Array<{ lat:number; lng:number; tHours:number }>>;
  envelope: Array<{ lat:number; lng:number }>;
  ranked: CandidateScore[];
}
