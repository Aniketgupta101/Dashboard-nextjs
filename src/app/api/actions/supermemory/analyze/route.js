import { NextResponse } from "next/server";
import {
  COHORT_DEFINITIONS,
  getActionCohortById,
} from "@/lib/action-cohorts";
import {
  buildLocalBehaviorAnalysis,
  searchCohortMemory,
} from "@/lib/supermemory-behavior";

function isDatabaseConnectionIssue(message) {
  return (
    message.includes("Missing database configuration") ||
    message.includes("does not exist") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("password authentication failed") ||
    message.includes("no pg_hba.conf entry")
  );
}

function getEmptyCohort(cohortId) {
  const definition = COHORT_DEFINITIONS[cohortId];
  if (!definition) return null;
  return {
    id: cohortId,
    ...definition,
    count: 0,
    users: [],
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const cohortId = String(body.cohortId || "");
    const question =
      String(body.question || "").trim() ||
      "What behavior pattern explains this cohort and what should we do next?";

    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: "Missing cohortId." },
        { status: 400 },
      );
    }

    let sourceStatus = { ok: true, message: "System database connected." };
    let cohort = await getActionCohortById(cohortId).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (!isDatabaseConnectionIssue(message)) throw error;
      sourceStatus = {
        ok: false,
        type: "database_connection_unavailable",
        message,
      };
      return getEmptyCohort(cohortId);
    });

    if (!cohort) {
      return NextResponse.json(
        { success: false, error: `Unknown cohort: ${cohortId}` },
        { status: 404 },
      );
    }

    const memorySearch = await searchCohortMemory(cohort, question);
    const analysis = buildLocalBehaviorAnalysis(cohort, question, memorySearch);

    return NextResponse.json({
      success: true,
      data: {
        sourceStatus,
        memorySearch,
        analysis,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Supermemory analysis failed.",
      },
      { status: 500 },
    );
  }
}

