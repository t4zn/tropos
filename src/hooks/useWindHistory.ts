"use client";

import { useState, useEffect, useCallback } from "react";

export interface WindHistoryEntry {
  time: string;
  hoursAgo: number;
  windSpeedKmh: number;
  windDeg: number;
  boundaryLayerHeight: number;
}

interface UseWindHistoryReturn {
  windHistory: WindHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  source: string | null;
}

/**
 * Fetches real hourly wind history for a receptor location.
 * Re-fetches when coordinates or lookback hours change.
 */
export function useWindHistory(
  lat: number | null,
  lng: number | null,
  hoursBack: number
): UseWindHistoryReturn {
  const [windHistory, setWindHistory] = useState<WindHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(
        `/api/wind-history?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&hours=${hoursBack}`,
        { signal: AbortSignal.timeout(12000) }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `API returned ${res.status}`);
      }

      const data = await res.json();
      setWindHistory(data.entries ?? []);
      setSource(data.source ?? "Open-Meteo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch wind history");
      setWindHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, hoursBack]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { windHistory, isLoading, error, source };
}
