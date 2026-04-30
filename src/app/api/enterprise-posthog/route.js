import { NextResponse } from "next/server";

const POSTHOG_API_KEY =
  process.env.ENTERPRISE_POSTHOG_PERSONAL_API_KEY ||
  process.env.ENTERPRISE_POSTHOG_API_KEY ||
  process.env.ENTERPRISE_POSTHOG_KEY ||
  process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID =
  process.env.ENTERPRISE_POSTHOG_PROJECT_ID || process.env.POSTHOG_PROJECT_ID;
const RAW_POSTHOG_HOST =
  process.env.ENTERPRISE_POSTHOG_HOST ||
  process.env.VITE_POSTHOG_HOST ||
  "https://us.posthog.com";

function normalizeApiHost(host) {
  if (!host) return "https://us.posthog.com";
  return host
    .replace("https://us.i.posthog.com", "https://us.posthog.com")
    .replace("https://eu.i.posthog.com", "https://eu.posthog.com");
}

async function posthogQuery(queryBody, apiHost, projectId, apiKey) {
  return fetch(`${apiHost}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queryBody),
  });
}

export async function GET(request) {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Enterprise PostHog configuration missing (ENTERPRISE_POSTHOG_API_KEY/ENTERPRISE_POSTHOG_KEY and ENTERPRISE_POSTHOG_PROJECT_ID).",
      },
      { status: 503 },
    );
  }
  if (POSTHOG_API_KEY.startsWith("phc_")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "PostHog query API needs a personal API key (e.g. phx_...). Set ENTERPRISE_POSTHOG_PERSONAL_API_KEY.",
      },
      { status: 503 },
    );
  }

  const after = request.nextUrl.searchParams.get("after");
  const before = request.nextUrl.searchParams.get("before");
  const enterpriseId = request.nextUrl.searchParams.get("enterpriseId");
  const apiHost = normalizeApiHost(RAW_POSTHOG_HOST);

  const dateFrom = after
    ? new Date(after).toISOString().replace("T", " ").replace("Z", "")
    : null;
  const dateTo = before
    ? new Date(before).toISOString().replace("T", " ").replace("Z", "")
    : null;

  const conditions = [];
  if (dateFrom) conditions.push(`timestamp >= '${dateFrom}'`);
  if (dateTo) conditions.push(`timestamp <= '${dateTo}'`);
  if (enterpriseId) {
    const safeEnterpriseId = enterpriseId.replace(/'/g, "''");
    conditions.push(`(
      JSONExtractString(properties, 'enterpriseId') = '${safeEnterpriseId}'
      OR JSONExtractString(properties, 'enterprise_id') = '${safeEnterpriseId}'
      OR JSONExtractString(properties, 'enterprise') = '${safeEnterpriseId}'
    )`);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const totalQuery = {
      query: {
        kind: "HogQLQuery",
        query: `SELECT count() as total_events, count(DISTINCT distinct_id) as active_users FROM events ${whereClause}`,
      },
    };
    const trendQuery = {
      query: {
        kind: "HogQLQuery",
        query: `
          SELECT toStartOfDay(timestamp) as date, count() as events
          FROM events
          ${whereClause}
          GROUP BY date
          ORDER BY date ASC
        `,
      },
    };
    const topEventsQuery = {
      query: {
        kind: "HogQLQuery",
        query: `
          SELECT event, count() as count
          FROM events
          ${whereClause}
          GROUP BY event
          ORDER BY count DESC
          LIMIT 12
        `,
      },
    };

    const [totalRes, trendRes, topEventsRes] = await Promise.all([
      posthogQuery(totalQuery, apiHost, POSTHOG_PROJECT_ID, POSTHOG_API_KEY),
      posthogQuery(trendQuery, apiHost, POSTHOG_PROJECT_ID, POSTHOG_API_KEY),
      posthogQuery(topEventsQuery, apiHost, POSTHOG_PROJECT_ID, POSTHOG_API_KEY),
    ]);

    if (!totalRes.ok || !trendRes.ok || !topEventsRes.ok) {
      const details = await Promise.all([
        totalRes.text(),
        trendRes.text(),
        topEventsRes.text(),
      ]);
      const combinedError = details.join(" | ");
      if (combinedError.includes("query:read")) {
        throw new Error(
          "PostHog API key is valid but missing scope: query:read. Update ENTERPRISE_POSTHOG_PERSONAL_API_KEY with a key that has query read access.",
        );
      }
      throw new Error(combinedError);
    }

    const totalData = await totalRes.json();
    const trendData = await trendRes.json();
    const topEventsData = await topEventsRes.json();

    return NextResponse.json({
      success: true,
      data: {
        totalEvents: Number(totalData.results?.[0]?.[0] || 0),
        activeUsers: Number(totalData.results?.[0]?.[1] || 0),
        eventsOverTime: (trendData.results || []).map((row) => ({
          date: row[0] ? String(row[0]).split(/[ T]/)[0] : row[0],
          count: Number(row[1] || 0),
        })),
        topEvents: (topEventsData.results || []).map((row) => ({
          event: row[0],
          count: Number(row[1] || 0),
        })),
      },
    });
  } catch (error) {
    console.error("Enterprise PostHog API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown PostHog error",
      },
      { status: 500 },
    );
  }
}
