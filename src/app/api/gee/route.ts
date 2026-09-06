import { NextResponse } from "next/server";
import {
  getGeeHarmonizationData,
  getGeeOrbitalAnchorForCoordinate,
  getGeeStateAudit,
} from "@/lib/earthEngine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "anchor") {
      const lat = parseFloat(searchParams.get("lat") || "28.6139");
      const lng = parseFloat(searchParams.get("lng") || "77.2090");
      const data = getGeeOrbitalAnchorForCoordinate(lat, lng);
      return NextResponse.json({ success: true, data });
    }

    if (type === "federation") {
      const state = (searchParams.get("state") || "DEL").toUpperCase() as "DEL" | "HAR" | "UP" | "PUN";
      const data = getGeeStateAudit(state);
      return NextResponse.json({ success: true, data });
    }

    // Default: Harmonization grid and Sentinel-5P baseline
    const data = getGeeHarmonizationData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "GEE API Error",
      },
      { status: 500 }
    );
  }
}
