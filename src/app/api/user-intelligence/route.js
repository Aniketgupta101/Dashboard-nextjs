import { NextResponse } from "next/server";
import {
  getUpgradeCandidates,
  getChurnRiskUsers,
  getUserHealthDistribution,
} from "@/lib/db-intelligence";

export async function GET() {
  try {
    const [upgradeCandidates, churnRisk, healthDistribution] = await Promise.all([
      getUpgradeCandidates(),
      getChurnRiskUsers(),
      getUserHealthDistribution(),
    ]);
    return NextResponse.json({
      success: true,
      data: { upgradeCandidates, churnRisk, healthDistribution },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
