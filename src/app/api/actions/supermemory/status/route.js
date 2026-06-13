import { NextResponse } from "next/server";
import { getSafeSupermemoryStatus } from "@/lib/supermemory-behavior";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: getSafeSupermemoryStatus(),
  });
}

