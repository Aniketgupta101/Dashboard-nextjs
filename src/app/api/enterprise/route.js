import { NextResponse } from "next/server";
import { getEnterprisePilotInsights } from "@/lib/db";

function toNumber(value) {
  return Number.parseInt(value || "0", 10);
}

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const enterpriseId = searchParams.get("enterpriseId");

    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const raw = await getEnterprisePilotInsights(startDate, endDate, enterpriseId);
    const summary = raw.summary || {};

    const activeEnterprises = toNumber(summary.activeEnterprises);
    const totalEnterprises = toNumber(summary.totalEnterprises);
    const onboardedEnterprises = toNumber(summary.onboardedEnterprises);
    const promptsInRange = toNumber(summary.promptsInRange);
    const activePromptUsers = toNumber(summary.activePromptUsers);
    const activePromptEnterprises = toNumber(summary.activePromptEnterprises);

    const onboardingRate =
      totalEnterprises > 0 ? (onboardedEnterprises / totalEnterprises) * 100 : 0;
    const enterpriseActivationRate =
      activeEnterprises > 0
        ? (activePromptEnterprises / activeEnterprises) * 100
        : 0;
    const promptsPerActiveUser =
      activePromptUsers > 0 ? promptsInRange / activePromptUsers : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          activeEnterprises,
          totalEnterprises,
          onboardedEnterprises,
          failedOnboarding: toNumber(summary.failedOnboarding),
          activeUsers: toNumber(summary.activeUsers),
          teams: toNumber(summary.teams),
          promptsInRange,
          activePromptUsers,
          activePromptEnterprises,
          onboardingRate,
          enterpriseActivationRate,
          promptsPerActiveUser,
        },
        dailyPrompts: (raw.dailyPrompts || []).map((r) => ({
          date: r.date,
          prompts: toNumber(r.prompts),
          users: toNumber(r.users),
          enterprises: toNumber(r.enterprises),
        })),
        topEnterprises: (raw.topEnterprises || []).map((r) => ({
          enterpriseId: r.enterpriseId,
          enterpriseName: r.enterpriseName,
          enterpriseSlug: r.enterpriseSlug,
          prompts: toNumber(r.prompts),
          users: toNumber(r.users),
        })),
        topTeams: (raw.topTeams || []).map((r) => ({
          teamName: r.teamName,
          enterpriseName: r.enterpriseName,
          enhancedPrompts: toNumber(r.enhancedPrompts),
        })),
        intents: (raw.intents || []).map((r) => ({
          intent: r.intent,
          count: toNumber(r.count),
        })),
        moderationActions: (raw.moderationActions || []).map((r) => ({
          action: r.action,
          count: toNumber(r.count),
        })),
        queueStatus: (raw.queueStatus || []).map((r) => ({
          status: r.status,
          count: toNumber(r.count),
        })),
        enterpriseOptions: (raw.enterpriseOptions || []).map((r) => ({
          enterpriseId: r.enterpriseId,
          enterpriseName: r.enterpriseName,
        })),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown enterprise API error";
    console.error("Enterprise API error:", errorMessage, error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
