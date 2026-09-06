"use client";

import { useState, useEffect, useCallback } from "react";
import type { CorridorApiResponse, CorridorStation } from "@/types/corridor";

interface UseCorridorDataReturn {
  stations: CorridorStation[];
  wind: CorridorApiResponse["wind"] | null;
  meta: CorridorApiResponse["meta"] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

/**
 * Custom hook to fetch live corridor air quality data from our API route.
 * Auto-refreshes every 10 minutes.
 */
export function useCorridorData(): UseCorridorDataReturn {
  const [stations, setStations] = useState<CorridorStation[]>([]);
  const [wind, setWind] = useState<CorridorApiResponse["wind"] | null>(null);
  const [meta, setMeta] = useState<CorridorApiResponse["meta"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/corridor", {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `API returned ${res.status}`);
      }

      const data: CorridorApiResponse = await res.json();
      setStations(data.stations);
      setWind(data.wind);
      setMeta(data.meta);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 10 minutes
    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { stations, wind, meta, isLoading, error, refetch: fetchData, lastUpdated };
}
