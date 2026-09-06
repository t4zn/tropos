"use client";

import { useState, useEffect, useCallback } from "react";

interface FireHotspot {
  lat: number;
  lng: number;
  brightness: number;
  scan: number;
  track: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: string;
  frp: number;
}

interface FirmsData {
  fires: FireHotspot[];
  corridorFireCount: number;
  fetchedAt: string;
  source: string;
}

interface UseFirmsDataReturn {
  fires: FireHotspot[];
  corridorFireCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  fetchedAt: string | null;
}

/**
 * Fetches live NASA FIRMS fire hotspot data from our API route.
 * Auto-refreshes every 10 minutes.
 */
export function useFirmsData(): UseFirmsDataReturn {
  const [fires, setFires] = useState<FireHotspot[]>([]);
  const [corridorFireCount, setCorridorFireCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/firms", {
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `FIRMS API returned ${res.status}`);
      }

      const data: FirmsData = await res.json();
      setFires(data.fires);
      setCorridorFireCount(data.corridorFireCount);
      setFetchedAt(data.fetchedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fire data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { fires, corridorFireCount, isLoading, error, refetch: fetchData, fetchedAt };
}
