import { NextResponse } from "next/server";
import { getAllPaidUsersDetail, getPaidUsersAnalytics } from "@/lib/db";

const EXCLUDED_PAID_EMAILS = [
  "14.20audio@gmail.com",
  "sonambhagat@gmail.com",
  "info@mindsynevolution.ai",
  "hiroshima@nagasaki.bomb",
  "saini.hemant005@gmail.com",
  "purivikram.a@gmail.com",
  "sahibamidha2001@gmail.com",
  "abhishekpatelbizzz@gmail.com",
];

export async function GET() {
  try {
    const [rows, analytics] = await Promise.all([
      getAllPaidUsersDetail(undefined, EXCLUDED_PAID_EMAILS),
      getPaidUsersAnalytics(undefined, EXCLUDED_PAID_EMAILS),
    ]);

    const users = rows.map((r) => ({
      userId: r.user_id,
      name: r.name || "—",
      email: r.email || "—",
      status: r.status || "—",
      joinedDate: r.joined_date,
      totalPrompts: parseInt(r.total_prompts || 0),
      lastActive: r.last_active,
    }));

    return NextResponse.json({
      success: true,
      _meta: { source: "consume_db/usertable+userstatus" },
      data: {
        users,
        total: users.length,
        analytics,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Paid Users API error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
