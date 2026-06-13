import { NextResponse } from "next/server";
import { getActionCohortById } from "@/lib/action-cohorts";
import { syncCohortToSendFox } from "@/lib/sendfox";

export async function POST(request) {
  try {
    const body = await request.json();
    const cohortId = String(body?.cohortId || "");
    const dryRun = body?.dryRun !== false;

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "cohortId is required." },
        { status: 400 },
      );
    }

    const cohort = await getActionCohortById(cohortId);
    if (!cohort) {
      return NextResponse.json(
        { success: false, error: "Unknown cohort." },
        { status: 404 },
      );
    }

    const result = await syncCohortToSendFox({
      cohortId,
      users: cohort.users,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      data: {
        cohort: {
          id: cohort.id,
          title: cohort.title,
          count: cohort.count,
        },
        result,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SendFox error",
      },
      { status: 500 },
    );
  }
}
