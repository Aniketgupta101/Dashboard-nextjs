import { NextResponse } from "next/server";
import { getCohortRetentionData } from "@/lib/db-cohorts";

export async function GET() {
  try {
    const rows = await getCohortRetentionData();
    const data = rows.map((row) => {
      const size = parseInt(row.cohort_size) || 0;
      const pct = (n) =>
        size > 0 ? Math.round((100 * parseInt(n || 0)) / size) : null;
      return {
        cohort_week: row.cohort_week,
        cohort_size: size,
        w0: pct(row.w0),
        w1: pct(row.w1),
        w2: pct(row.w2),
        w4: pct(row.w4),
        w8: pct(row.w8),
        w0_count: parseInt(row.w0 || 0),
        w1_count: parseInt(row.w1 || 0),
        w2_count: parseInt(row.w2 || 0),
        w4_count: parseInt(row.w4 || 0),
        w8_count: parseInt(row.w8 || 0),
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
