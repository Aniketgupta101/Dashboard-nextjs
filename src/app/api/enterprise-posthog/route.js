import { NextResponse } from "next/server";
import {
  allTrackedEventNames,
  sqlEnterpriseScope,
  sqlEventInList,
  sqlNoiseExclusion,
  sqlTimestampRange,
  VELOCITY_EVENT_GROUPS,
} from "@/lib/enterprise-posthog-analytics";

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

async function hogql(apiHost, projectId, apiKey, sql) {
  const res = await posthogQuery(
    { query: { kind: "HogQLQuery", query: sql } },
    apiHost,
    projectId,
    apiKey,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PostHog HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.results || [];
}

function baseWhere(dateFrom, dateTo, safeEnterpriseId) {
  const ts = sqlTimestampRange(dateFrom, dateTo);
  const ent = sqlEnterpriseScope(safeEnterpriseId);
  const noise = sqlNoiseExclusion();
  return `${ts} AND ${ent} AND ${noise}`;
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

  const safeEnterpriseId = enterpriseId
    ? enterpriseId.replace(/'/g, "''")
    : "";
  const bw = baseWhere(dateFrom, dateTo, safeEnterpriseId);
  const trackedInventory = allTrackedEventNames();

  try {
    const [
      totalRows,
      trendRows,
      topEventsRows,
      authRows,
      loginFailRows,
      loginMethodRows,
      promptsDayRows,
      dauRows,
      modelRows,
      speedRows,
      refineRow,
      promptRow,
      attachRow,
      govRows,
      policyRows,
      exportRows,
      persRows,
      starterRows,
      roleRows,
      notifRows,
      auditRows,
      flaggedRow,
    ] = await Promise.all([
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS total_events, count(DISTINCT distinct_id) AS active_users FROM events WHERE ${bw}`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT toStartOfDay(timestamp) AS date, count() AS events FROM events WHERE ${bw} GROUP BY date ORDER BY date ASC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT event, count() AS c FROM events WHERE ${bw} GROUP BY event ORDER BY c DESC LIMIT 16`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT event, count() AS c FROM events WHERE ${bw} AND ${sqlEventInList(VELOCITY_EVENT_GROUPS.auth)} GROUP BY event ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(nullIf(JSONExtractString(properties, 'error_type'), ''), 'unknown') AS error_type,
           count() AS c
         FROM events WHERE ${bw} AND event = 'login_failed'
         GROUP BY error_type ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(nullIf(JSONExtractString(properties, 'method'), ''), 'unknown') AS method,
           count() AS c
         FROM events WHERE ${bw} AND event = 'login_success'
         GROUP BY method ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT toStartOfDay(timestamp) AS date, count() AS prompts
         FROM events WHERE ${bw} AND event = 'prompt_submitted'
         GROUP BY date ORDER BY date ASC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT toStartOfDay(timestamp) AS date, count(DISTINCT distinct_id) AS dau
         FROM events WHERE ${bw}
         GROUP BY date ORDER BY date ASC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(nullIf(JSONExtractString(properties, 'model_used'), ''), 'unknown') AS model,
           count() AS c
         FROM events WHERE ${bw} AND event = 'prompt_submitted'
         GROUP BY model ORDER BY c DESC LIMIT 12`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(nullIf(JSONExtractString(properties, 'speed_mode'), ''), 'unknown') AS speed_mode,
           count() AS c
         FROM events WHERE ${bw} AND event = 'prompt_submitted'
         GROUP BY speed_mode ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS c FROM events WHERE ${bw} AND event = 'prompt_refinement_submitted'`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS c FROM events WHERE ${bw} AND event = 'prompt_submitted'`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS c FROM events WHERE ${bw} AND event = 'file_attached'`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT event, count() AS c FROM events WHERE ${bw} AND ${sqlEventInList(VELOCITY_EVENT_GROUPS.governance)} GROUP BY event ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT event, count() AS c FROM events WHERE ${bw} AND event IN ('data_protection_rule_toggled', 'tool_access_toggled') GROUP BY event`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(nullIf(JSONExtractString(properties, 'export_type'), ''), 'unknown') AS export_type,
           count() AS c
         FROM events WHERE ${bw} AND event = 'csv_exported'
         GROUP BY export_type ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           countIf(event = 'personalization_profile_saved') AS saved,
           countIf(event = 'personalization_viewed') AS viewed
         FROM events WHERE ${bw}`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT event, count() AS c FROM events WHERE ${bw} AND event IN (
           'starter_prompt_viewed', 'starter_prompt_shuffle_clicked', 'starter_prompt_selected'
         ) GROUP BY event`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           coalesce(
             nullIf(JSONExtractString(properties, 'user_role'), ''),
             nullIf(JSONExtractString(properties, 'role'), ''),
             'unknown'
           ) AS role,
           count() AS c
         FROM events WHERE ${bw} AND event = 'login_success'
         GROUP BY role ORDER BY c DESC`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT
           countIf(event = 'notification_read') AS read_,
           countIf(event = 'notifications_viewed') AS views
         FROM events WHERE ${bw}`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS c FROM events WHERE ${bw} AND event = 'audit_log_viewed'`,
      ),
      hogql(
        apiHost,
        POSTHOG_PROJECT_ID,
        POSTHOG_API_KEY,
        `SELECT count() AS c FROM events WHERE ${bw} AND event IN ('prompt_flagged_by_system', 'vygr_brand_safety_flag_triggered', 'vygr_pii_detected', 'vygr_api_key_blocked')`,
      ),
    ]);

    const totalEvents = Number(totalRows?.[0]?.[0] || 0);
    const activeUsers = Number(totalRows?.[0]?.[1] || 0);

    const eventsOverTime = (trendRows || []).map((row) => ({
      date: row[0] ? String(row[0]).split(/[ T]/)[0] : row[0],
      count: Number(row[1] || 0),
    }));

    const topEvents = (topEventsRows || []).map((row) => ({
      event: row[0],
      count: Number(row[1] || 0),
    }));

    const promptTotal = Number(promptRow?.[0]?.[0] || 0);
    const refinementTotal = Number(refineRow?.[0]?.[0] || 0);
    const attachTotal = Number(attachRow?.[0]?.[0] || 0);

    const dauSeries = (dauRows || []).map((row) => ({
      date: row[0] ? String(row[0]).split(/[ T]/)[0] : row[0],
      dau: Number(row[1] || 0),
    }));
    const avgDau =
      dauSeries.length > 0
        ? dauSeries.reduce((a, x) => a + x.dau, 0) / dauSeries.length
        : 0;
    const engagementIndex =
      activeUsers > 0 ? Math.min(1, avgDau / activeUsers) : 0;

    const persSaved = Number(persRows?.[0]?.[0] || 0);
    const persViewed = Number(persRows?.[0]?.[1] || 0);

    const readN = Number(notifRows?.[0]?.[0] || 0);
    const notifViews = Number(notifRows?.[0]?.[1] || 0);

    const data = {
      totalEvents,
      activeUsers,
      eventsOverTime,
      topEvents,
      avgDailyEvents:
        eventsOverTime.length > 0
          ? totalEvents / eventsOverTime.length
          : 0,
      orgHealth: {
        promptsPerDay: (promptsDayRows || []).map((row) => ({
          date: row[0] ? String(row[0]).split(/[ T]/)[0] : row[0],
          prompts: Number(row[1] || 0),
        })),
        dauTrend: dauSeries,
        avgDau: Math.round(avgDau * 10) / 10,
        engagementIndex: Math.round(engagementIndex * 1000) / 1000,
        trackedEventInventory: trackedInventory.length,
      },
      acquisition: {
        authEvents: (authRows || []).map((row) => ({
          event: row[0],
          count: Number(row[1] || 0),
        })),
        loginFailureByType: (loginFailRows || []).map((row) => ({
          errorType: row[0],
          count: Number(row[1] || 0),
        })),
        loginMethod: (loginMethodRows || []).map((row) => ({
          method: row[0],
          count: Number(row[1] || 0),
        })),
      },
      promptIntelligence: {
        promptSubmissions: promptTotal,
        refinements: refinementTotal,
        refinementRate:
          promptTotal > 0
            ? Math.round((1000 * refinementTotal) / promptTotal) / 10
            : 0,
        modelDistribution: (modelRows || []).map((row) => ({
          model: row[0],
          count: Number(row[1] || 0),
        })),
        speedModeDistribution: (speedRows || []).map((row) => ({
          speedMode: row[0],
          count: Number(row[1] || 0),
        })),
        attachmentEvents: attachTotal,
        attachmentRate:
          promptTotal > 0
            ? Math.round((1000 * attachTotal) / promptTotal) / 10
            : 0,
        starterEvents: (starterRows || []).map((row) => ({
          event: row[0],
          count: Number(row[1] || 0),
        })),
      },
      governance: {
        governanceEvents: (govRows || []).map((row) => ({
          event: row[0],
          count: Number(row[1] || 0),
        })),
        policyToggles: (policyRows || []).map((row) => ({
          event: row[0],
          count: Number(row[1] || 0),
        })),
        flaggedOrViolationEvents: Number(flaggedRow?.[0]?.[0] || 0),
        flaggedRate:
          promptTotal > 0
            ? Math.round((1000 * Number(flaggedRow?.[0]?.[0] || 0)) / promptTotal) / 10
            : 0,
        auditLogViews: Number(auditRows?.[0]?.[0] || 0),
      },
      engagement: {
        personalizationSaves: persSaved,
        personalizationViews: persViewed,
        personalizationCompletionRate:
          persViewed > 0
            ? Math.round((1000 * persSaved) / persViewed) / 10
            : 0,
        notificationReads: readN,
        notificationViews: notifViews,
        notificationReadRate:
          notifViews > 0
            ? Math.round((1000 * readN) / notifViews) / 10
            : 0,
      },
      adminOps: {
        exportsByType: (exportRows || []).map((row) => ({
          exportType: row[0],
          count: Number(row[1] || 0),
        })),
        roleAtLogin: (roleRows || []).map((row) => ({
          role: row[0],
          count: Number(row[1] || 0),
        })),
      },
      meta: {
        eventGroupsDocumented: Object.keys(VELOCITY_EVENT_GROUPS).length,
        specification: "Velocity Enterprise event matrix (Sections 2–4, 3.x)",
      },
    };

    return NextResponse.json({ success: true, _meta: { source: "posthog/enterprise_project" }, data });
  } catch (error) {
    console.error("Enterprise PostHog API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown PostHog error";
    if (msg.includes("query:read")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PostHog API key is valid but missing scope: query:read. Update ENTERPRISE_POSTHOG_PERSONAL_API_KEY with a key that has query read access.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
