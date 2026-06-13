import { NextResponse } from "next/server";
import { getActionCohorts, getEmptyActionCohorts } from "@/lib/action-cohorts";

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

export async function GET() {
  try {
    const data = await getActionCohorts();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown actions error";
    if (isDatabaseConnectionIssue(message)) {
      return NextResponse.json({
        success: true,
        data: getEmptyActionCohorts({
          ok: false,
          type: "database_connection_unavailable",
          message,
        }),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
