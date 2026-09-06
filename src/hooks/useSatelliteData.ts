"use client";

import { useState, useEffect, useCallback } from "react";

type Channel = "VIS" | "IR1" | "SWIR" | "WV";

interface ScanSlot {
  utcTime: string;
  istTime: string;
  dateLabel: string;
  channels: Record<string, string>;
}

interface AodSlot {
  utcTime: string;
  istTime: string;
  dateLabel: string;
  url: string;
}

interface SatelliteData {
  scans: ScanSlot[];
  aodScans: AodSlot[];
  channels: Record<string, string>;
  satellite: string;
  orbit: string;
  fetchedAt: string;
}

interface UseSatelliteDataReturn {
  scans: ScanSlot[];
  aodScans: AodSlot[];
  channelLabels: Record<string, string>;
  satellite: string;
  orbit: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches ISRO MOSDAC satellite scan slot URLs from our API route.
 * Returns both L1B channel scans and confirmed L2G AOD scans separately.
 */
export function useSatelliteData(): UseSatelliteDataReturn {
  const [scans, setScans] = useState<ScanSlot[]>([]);
  const [aodScans, setAodScans] = useState<AodSlot[]>([]);
  const [channelLabels, setChannelLabels] = useState<Record<string, string>>({
    VIS: "Visible",
    IR1: "Thermal Infrared",
    SWIR: "Shortwave IR",
    WV: "Water Vapor",
    AOD: "Aerosol Optical Depth",
  });
  const [satellite, setSatellite] = useState("INSAT-3DS");
  const [orbit, setOrbit] = useState("Geostationary 82°E");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/satellite", {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Satellite API returned ${res.status}`);
      }

      const data: SatelliteData = await res.json();
      setScans(data.scans);
      setAodScans(data.aodScans || []);
      setChannelLabels(data.channels);
      setSatellite(data.satellite);
      setOrbit(data.orbit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch satellite data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 15 minutes (new scans become available)
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { scans, aodScans, channelLabels, satellite, orbit, isLoading, error, refetch: fetchData };
}

