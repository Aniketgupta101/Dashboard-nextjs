import { NextResponse } from "next/server";
import { getDistributionData, makeUtmUrl } from "@/lib/distribution-data";

export async function GET(request) {
  const platform = request.nextUrl.searchParams.get("platform");
  const campaign =
    request.nextUrl.searchParams.get("campaign") || "think_velocity_launch";

  if (platform) {
    return NextResponse.json({
      success: true,
      data: {
        platform,
        url: makeUtmUrl(platform, campaign),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: getDistributionData(),
  });
}
