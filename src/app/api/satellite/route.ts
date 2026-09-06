import { NextResponse } from "next/server";

/**
 * ISRO MOSDAC Satellite Imagery API Route
 * Constructs live preview image URLs for INSAT-3DS satellite scans.
 *
 * L1B Standard (every 30 min):
 * https://mosdac.gov.in/look/3S_IMG/preview/{YEAR}/{DDMON}/3SIMG_{DDMONYEAR}_{HHMM}_L1B_STD_{CHANNEL}_V01R00.jpg
 *
 * L2G AOD (daytime only, ~0530–0830 UTC / 11 AM–2 PM IST):
 * https://mosdac.gov.in/look/3S_IMG/preview/{YEAR}/{DDMON}/3SIMG_{DDMONYEAR}_{HHMM}_L2G_AOD_V01R00.jpg
 */

const MOSDAC_BASE = "https://mosdac.gov.in/look/3S_IMG/preview";

const CHANNELS = ["IR1", "VIS", "SWIR", "WV"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel | "AOD", string> = {
  VIS: "Visible",
  IR1: "Thermal Infrared",
  SWIR: "Shortwave IR",
  WV: "Water Vapor",
  AOD: "Aerosol Optical Depth",
};

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

interface SatelliteApiResponse {
  scans: ScanSlot[];
  aodScans: AodSlot[];
  channels: typeof CHANNEL_LABELS;
  satellite: string;
  orbit: string;
  fetchedAt: string;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatMosdacDate(d: Date): { year: string; ddmon: string; ddmonyear: string } {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()];
  const year = String(d.getUTCFullYear());
  return { year, ddmon: `${day}${mon}`, ddmonyear: `${day}${mon}${year}` };
}

function buildImageUrl(year: string, ddmon: string, ddmonyear: string, time: string, channel: string): string {
  const product = channel === "AOD" ? "L2G_AOD" : `L1B_STD_${channel}`;
  return `${MOSDAC_BASE}/${year}/${ddmon}/3SIMG_${ddmonyear}_${time}_${product}_V01R00.jpg`;
}

function utcToIst(hours: number, minutes: number): string {
  let istMin = minutes + 30;
  let istHour = hours + 5;
  if (istMin >= 60) {
    istMin -= 60;
    istHour += 1;
  }
  istHour = istHour % 24;
  const h = istHour > 12 ? istHour - 12 : istHour === 0 ? 12 : istHour;
  const ampm = istHour >= 12 ? "PM" : "AM";
  return `${h}:${String(istMin).padStart(2, "0")} ${ampm} IST`;
}

/**
 * Probes MOSDAC for available AOD images via HEAD requests.
 * AOD is Level-2 derived, only during daytime (~0530–0830 UTC).
 * Checks today first, then yesterday, returning confirmed URLs.
 */
async function findAvailableAod(): Promise<AodSlot[]> {
  const now = new Date();
  const aodSlots: AodSlot[] = [];

  // Check today + yesterday
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const { year, ddmon, ddmonyear } = formatMosdacDate(day);

    // AOD candidate times: 0500–1000 UTC in 30-min steps
    const candidates = ["0500", "0530", "0600", "0630", "0700", "0730", "0800", "0830", "0900", "0930", "1000"];

    const checks = candidates.map(async (time) => {
      const url = buildImageUrl(year, ddmon, ddmonyear, time, "AOD");
      try {
        const resp = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const h = parseInt(time.slice(0, 2));
          const m = parseInt(time.slice(2, 4));
          return { utcTime: time, istTime: utcToIst(h, m), dateLabel: ddmonyear, url };
        }
      } catch {
        // skip
      }
      return null;
    });

    const results = await Promise.all(checks);
    for (const r of results) {
      if (r) aodSlots.push(r);
    }

    // If we found AOD for today, don't bother with yesterday
    if (aodSlots.length > 0) break;
  }

  // Sort newest first
  aodSlots.sort((a, b) => b.utcTime.localeCompare(a.utcTime));
  return aodSlots;
}

export async function GET() {
  try {
    const now = new Date();

    // ─── L1B Standard channel scans (every 30 min) ───────────────────────
    const scans: ScanSlot[] = [];
    const seenKeys = new Set<string>();

    for (let offset = 4; offset < 20; offset++) {
      if (scans.length >= 8) break;

      const scanTime = new Date(now.getTime() - offset * 30 * 60 * 1000);
      const utcHour = scanTime.getUTCHours();
      const utcMinute = (Math.floor(scanTime.getUTCMinutes() / 30)) * 30;

      const key = `${scanTime.getUTCFullYear()}-${scanTime.getUTCMonth()}-${scanTime.getUTCDate()}-${utcHour}-${utcMinute}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const { year, ddmon, ddmonyear } = formatMosdacDate(scanTime);
      const timeStr = `${String(utcHour).padStart(2, "0")}${String(utcMinute).padStart(2, "0")}`;

      const channels: Record<string, string> = {};
      for (const ch of CHANNELS) {
        channels[ch] = buildImageUrl(year, ddmon, ddmonyear, timeStr, ch);
      }

      scans.push({
        utcTime: timeStr,
        istTime: utcToIst(utcHour, utcMinute),
        dateLabel: ddmonyear,
        channels,
      });
    }

    // ─── AOD Level-2 scans (probe for real availability) ─────────────────
    const aodScans = await findAvailableAod();

    const response: SatelliteApiResponse = {
      scans,
      aodScans,
      channels: CHANNEL_LABELS,
      satellite: "INSAT-3DS",
      orbit: "Geostationary 82°E",
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate satellite scan URLs";
    console.error("[Satellite API Error]:", msg);
    return NextResponse.json(
      { error: msg, source: "mosdac", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
