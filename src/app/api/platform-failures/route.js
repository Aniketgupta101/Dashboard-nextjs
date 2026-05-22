import { NextResponse } from "next/server";
import { getEnhancementFailuresByPlatform } from "@/lib/db-p0-fixes";

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate"))
      : null;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate"))
      : null;
    const data = await getEnhancementFailuresByPlatform(startDate, endDate);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
