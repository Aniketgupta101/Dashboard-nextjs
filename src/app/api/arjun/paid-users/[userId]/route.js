import { NextResponse } from "next/server";
import { getPaidUserBehavior } from "@/lib/db";

function toNumber(value) {
  return Number.parseInt(value || "0", 10);
}

export async function GET(_request, { params }) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 },
      );
    }

    const raw = await getPaidUserBehavior(userId);
    const summary = raw.summary || {};
    const prompts = toNumber(summary.prompts);
    const enhancedPrompts = toNumber(summary.enhanced_prompts);
    const refinements = toNumber(summary.refinements);
    const activeDays = toNumber(summary.active_days);

    return NextResponse.json({
      success: true,
      _meta: { source: "consume_db/user-level-paid-user-detail" },
      data: {
        profile: raw.profile
          ? {
              userId: raw.profile.user_id,
              name: raw.profile.name || "—",
              email: raw.profile.email || "—",
              status: raw.profile.status || "—",
              joinedAt: raw.profile.joined_at,
              installed: Boolean(raw.profile.installed),
              onboardingCompleted: Boolean(raw.profile.onboarding_completed),
              occupation: raw.profile.occupation || null,
              llmPlatform: raw.profile.llm_platform || null,
            }
          : null,
        summary: {
          prompts,
          enhancedPrompts,
          enhancementRate:
            prompts > 0 ? Math.round((enhancedPrompts / prompts) * 100) : 0,
          refinements,
          refinementRate:
            enhancedPrompts > 0
              ? Math.round((refinements / enhancedPrompts) * 100)
              : 0,
          activeDays,
          firstActive: summary.first_active,
          lastActive: summary.last_active,
          avgTokens: toNumber(summary.avg_tokens),
          totalTokens: toNumber(summary.total_tokens),
        },
        daily: raw.daily || [],
        intents: raw.intents || [],
        domains: raw.domains || [],
        modes: raw.modes || [],
        hourly: raw.hourly || [],
        recentPrompts: raw.recentPrompts || [],
        unknownIntent: raw.unknownIntent || {},
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown user detail error";
    console.error("Paid user detail API error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
