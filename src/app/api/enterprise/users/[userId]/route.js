import { NextResponse } from "next/server";
import { getEnterpriseUserBehavior } from "@/lib/db";

function toNumber(value) {
  return Number.parseInt(value || "0", 10);
}

export async function GET(request, { params }) {
  try {
    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const enterpriseId = searchParams.get("enterpriseId");
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!enterpriseId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing enterpriseId or userId" },
        { status: 400 },
      );
    }

    const raw = await getEnterpriseUserBehavior({
      enterpriseId,
      userId,
      startDate: startDateStr ? new Date(startDateStr) : null,
      endDate: endDateStr ? new Date(endDateStr) : null,
    });

    const summary = raw.summary || {};
    const consumer = raw.consumerUsage || {};
    const enterprisePrompts = toNumber(summary.enterprisePrompts);
    const consumerPrompts = toNumber(consumer.consumer_prompts);
    const totalMatchedPrompts = enterprisePrompts + consumerPrompts;

    return NextResponse.json({
      success: true,
      _meta: {
        source:
          "enterprise_db/User+UserPrompt+EnhancedPrompt plus consume_db/usertable+user_prompts by email",
      },
      data: {
        profile: raw.profile,
        summary: {
          enterprisePrompts,
          enterpriseActiveDays: toNumber(summary.enterpriseActiveDays),
          enhancedPrompts: toNumber(summary.enhancedPrompts),
          firstActive: summary.firstActive,
          lastActive: summary.lastActive,
          avgTokens: toNumber(summary.avgTokens),
          totalTokens: toNumber(summary.totalTokens),
          consumerPrompts,
          consumerActiveDays: toNumber(consumer.consumer_active_days),
          consumerLastActive: consumer.consumer_last_active || null,
          consumerStatus: consumer.status || null,
          consumerUserId: consumer.user_id || null,
          enterpriseShare:
            totalMatchedPrompts > 0
              ? Math.round((enterprisePrompts / totalMatchedPrompts) * 100)
              : 0,
          consumerShare:
            totalMatchedPrompts > 0
              ? Math.round((consumerPrompts / totalMatchedPrompts) * 100)
              : 0,
        },
        daily: raw.daily || [],
        intents: raw.intents || [],
        domains: raw.domains || [],
        modes: raw.modes || [],
        recentPrompts: raw.recentPrompts || [],
      },
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unknown enterprise user detail error";
    console.error("Enterprise user detail API error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
