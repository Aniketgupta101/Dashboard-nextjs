import { Pool } from "pg";
import {
  STAKEHOLDER_EXCLUDED_NAMES_LOWER,
  TEST_USER_IDS,
} from "./constants";

const appVariant =
  (process.env.APP_VARIANT || "consume").toLowerCase() === "enterprise"
    ? "enterprise"
    : "consume";

const variantPrefix = appVariant === "enterprise" ? "ENTERPRISE" : "CONSUME";
const getVariantEnv = (key) =>
  process.env[`${variantPrefix}_${key}`] || process.env[key];

const databaseUrl = getVariantEnv("DATABASE_URL");
const hasDiscreteConfig =
  getVariantEnv("DB_HOST") &&
  getVariantEnv("DB_USER") &&
  getVariantEnv("DB_NAME") &&
  getVariantEnv("DB_PORT");

function getDbConfigError() {
  if (databaseUrl) return null;
  if (hasDiscreteConfig && typeof getVariantEnv("DB_PASSWORD") === "string")
    return null;
  return `Missing database configuration for APP_VARIANT=${appVariant}. Set ${variantPrefix}_DATABASE_URL (or DATABASE_URL), or set ${variantPrefix}_DB_HOST, ${variantPrefix}_DB_USER, ${variantPrefix}_DB_PASSWORD, ${variantPrefix}_DB_PORT, and ${variantPrefix}_DB_NAME.`;
}

// Decode URL-encoded password (e.g., %40 -> @)
const password =
  typeof getVariantEnv("DB_PASSWORD") === "string"
    ? decodeURIComponent(getVariantEnv("DB_PASSWORD"))
    : "";

// Database connection pool
const pool = new Pool(
  databaseUrl
    ? {
        connectionString: databaseUrl,
        ssl: false, // Server doesn't support SSL
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: getVariantEnv("DB_HOST"),
        user: getVariantEnv("DB_USER"),
        password: password,
        port: parseInt(getVariantEnv("DB_PORT") || "5432", 10),
        database: getVariantEnv("DB_NAME"),
        ssl: false, // Server doesn't support SSL
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
);

const enterpriseDatabaseUrl = process.env.ENTERPRISE_DATABASE_URL;
const enterpriseHasDiscreteConfig =
  process.env.ENTERPRISE_DB_HOST &&
  process.env.ENTERPRISE_DB_USER &&
  process.env.ENTERPRISE_DB_NAME &&
  process.env.ENTERPRISE_DB_PORT &&
  typeof process.env.ENTERPRISE_DB_PASSWORD === "string";

const enterprisePassword =
  typeof process.env.ENTERPRISE_DB_PASSWORD === "string"
    ? decodeURIComponent(process.env.ENTERPRISE_DB_PASSWORD)
    : "";

const enterprisePool =
  enterpriseDatabaseUrl || enterpriseHasDiscreteConfig
    ? new Pool(
        enterpriseDatabaseUrl
          ? {
              connectionString: enterpriseDatabaseUrl,
              ssl: false,
              max: 10,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
            }
          : {
              host: process.env.ENTERPRISE_DB_HOST,
              user: process.env.ENTERPRISE_DB_USER,
              password: enterprisePassword,
              port: parseInt(process.env.ENTERPRISE_DB_PORT || "5432", 10),
              database: process.env.ENTERPRISE_DB_NAME,
              ssl: false,
              max: 10,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
            },
      )
    : null;

async function executeEnterpriseQuery(query, params) {
  if (!enterprisePool) {
    throw new Error(
      "Missing enterprise database configuration. Set ENTERPRISE_DATABASE_URL or ENTERPRISE_DB_HOST, ENTERPRISE_DB_USER, ENTERPRISE_DB_PASSWORD, ENTERPRISE_DB_PORT, ENTERPRISE_DB_NAME.",
    );
  }

  try {
    const result = await enterprisePool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Enterprise query failed:", error);
    throw error;
  }
}

/** SQL fragments for excluding test user IDs and stakeholder display names (see STAKEHOLDER_EXCLUDED_NAMES_LOWER). */

function pushExcludedUserIdsClause(params, excludeUsers, alias = "u") {
  if (!excludeUsers?.length) return null;
  const placeholders = excludeUsers.map(
    (_, i) => `$${params.length + i + 1}`,
  );
  excludeUsers.forEach((id) => params.push(String(id)));
  return `${alias}.user_id::text NOT IN (${placeholders.join(", ")})`;
}

function pushStakeholderNameExcludeClause(params, alias = "u") {
  const names = STAKEHOLDER_EXCLUDED_NAMES_LOWER;
  if (!names.length) return null;
  const placeholders = names.map((_, i) => `$${params.length + i + 1}`);
  names.forEach((n) => params.push(n));
  return `LOWER(TRIM(COALESCE(${alias}.name, ''))) NOT IN (${placeholders.join(", ")})`;
}

function pushUsertableExclusionConditions(params, excludeUsers, alias = "u") {
  const parts = [];
  const idPart = pushExcludedUserIdsClause(params, excludeUsers, alias);
  if (idPart) parts.push(idPart);
  const namePart = pushStakeholderNameExcludeClause(params, alias);
  if (namePart) parts.push(namePart);
  return parts;
}

function pushStakeholderNotExistsForPromptUser(params, alias = "up") {
  const names = STAKEHOLDER_EXCLUDED_NAMES_LOWER;
  if (!names.length) return null;
  const placeholders = names.map((_, i) => `$${params.length + i + 1}`);
  names.forEach((n) => params.push(n));
  return `NOT EXISTS (
    SELECT 1 FROM usertable ux
    WHERE ux.user_id::text = ${alias}.user_id::text
    AND LOWER(TRIM(COALESCE(ux.name, ''))) IN (${placeholders.join(", ")})
  )`;
}

function pushPromptTableExclusionConditions(params, excludeUsers, alias = "up") {
  const parts = [];
  const idPart = pushExcludedUserIdsClause(params, excludeUsers, alias);
  if (idPart) parts.push(idPart);
  const stakePart = pushStakeholderNotExistsForPromptUser(params, alias);
  if (stakePart) parts.push(stakePart);
  return parts;
}

/**
 * Standard 5-table FROM + JOIN block shared by analytics, usage, and attrition queries.
 * Alias conventions: up=user_prompts, sep=save_enhance_prompt, rp=refine_prompt,
 *                    u=usertable, us=userstatus
 */
export const BASE_PROMPT_FROM_JOINS = `
  FROM user_prompts up
  LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
  LEFT JOIN refine_prompt rp        ON sep.enhanced_prompt_id = rp.enhanced_prompt_id
  LEFT JOIN usertable u              ON up.user_id = u.user_id
  LEFT JOIN userstatus us            ON up.user_id = us.user_id
`;

/**
 * Appends date + source filter conditions to an existing params/conditions array.
 * Returns the (potentially modified) sourceJoin string for functions that build
 * the JOIN inline based on source mode.
 */
export function addDateSourceFilters(params, conditions, { startDate, endDate, source } = {}) {
  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`up.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`up.created_at <= $${params.length}`);
  }
  if (source === "Chat") {
    params.push("velocity");
    conditions.push(`sep.llm_used ILIKE $${params.length}`);
  } else if (source === "Extension") {
    params.push("velocity");
    conditions.push(`(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`);
  }
}

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

// Execute a query
export async function executeQuery(query, params) {
  const configError = getDbConfigError();
  if (configError) {
    throw new Error(configError);
  }

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Query execution failed:", error);
    throw error;
  }
}

// Get analytics data with date range and source filter (READ-ONLY QUERY)
export async function getAnalyticsData(
  startDate,
  endDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  const selectCols = `
    SELECT
      up.prompt_id,
      up.user_id,
      up.user_prompt,
      up.created_at as prompt_created_at,
      sep.enhanced_prompt,
      sep.processing_time,
      sep.intent,
      sep.llm_used,
      sep.complexity,
      sep.domain,
      sep.mode,
      sep.input_token,
      sep.output_token,
      sep.total_token,
      rp.input_token as refine_input_token,
      rp.output_token as refine_output_token,
      rp.total_token as refine_total_token,
      COALESCE(us.status, sep.user_status) as user_status,
      sep.created_at as enhanced_prompt_created_at,
      CASE WHEN rp.refine_id IS NOT NULL THEN true ELSE false END as has_refinement,
      u.name as user_name,
      u.email as user_email,
      u.installed
  `;

  const params = [];
  const conditions = [];

  addDateSourceFilters(params, conditions, { startDate, endDate, source });
  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  let query = selectCols + BASE_PROMPT_FROM_JOINS;

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY up.created_at DESC`;

  return executeQuery(query, params).then((rows) => {
    if (rows.length > 0) {
      console.log("DB Analytics Sample Row:", {
        input_token: rows[0].input_token,
        output_token: rows[0].output_token,
        sep_enhanced_prompt: !!rows[0].enhanced_prompt,
      });
    }
    return rows;
  });
}

// Get total paid users cumulative count by date (regardless of activity)
export async function getTotalPaidUsersByDate(
  startDate,
  endDate,
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const conditions = [];

  // Paid status check - exact match for 'pro' status
  conditions.push(`COALESCE(us.status, 'free') = 'pro'`);

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  // Get all paid users with their creation date
  const query = `
    SELECT 
      u.user_id,
      u.created_at::date as user_created_date
    FROM usertable u
    JOIN userstatus us ON u.user_id = us.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY u.created_at
  `;

  const rows = await executeQuery(query, params);
  return rows;
}

// Get distinct paid users active before a specific date (for cumulative baseline)
// Get distinct paid users active before a specific date (for cumulative baseline)
export async function getPriorPaidUsers(
  beforeDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  if (!beforeDate) return [];

  const params = [beforeDate.toISOString()];
  const conditions = [`u.created_at < $1`];

  // Helper for paid status check matches the one in analytics-utils
  conditions.push(
    `(LOWER(COALESCE(us.status, '')) LIKE '%paid%' OR LOWER(COALESCE(us.status, '')) LIKE '%pro%' OR LOWER(COALESCE(us.status, '')) LIKE '%premium%')`,
  );

  let joinClause = "LEFT JOIN userstatus us ON u.user_id = us.user_id";

  if (source === "Chat") {
    joinClause +=
      " LEFT JOIN user_prompts up_filter ON u.user_id = up_filter.user_id LEFT JOIN save_enhance_prompt sep_filter ON up_filter.prompt_id = sep_filter.prompt_id";
    params.push("velocity");
    conditions.push(`sep_filter.llm_used ILIKE $${params.length}`);
  } else if (source === "Extension") {
    joinClause +=
      " LEFT JOIN user_prompts up_filter ON u.user_id = up_filter.user_id LEFT JOIN save_enhance_prompt sep_filter ON up_filter.prompt_id = sep_filter.prompt_id";
    params.push("velocity");
    conditions.push(
      `(sep_filter.llm_used NOT ILIKE $${params.length} OR sep_filter.llm_used IS NULL)`,
    );
  }

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  const query = `
    SELECT DISTINCT u.user_id
    FROM usertable u
    ${joinClause}
    WHERE ${conditions.join(" AND ")}
  `;

  const rows = await executeQuery(query, params);
  return rows.map((r) => r.user_id);
}

// Get all paid users with full details (for Paid Users page)
export async function getAllPaidUsersDetail(excludeUsers = TEST_USER_IDS, excludeEmails = []) {
  const params = [];
  const conditions = [
    `(LOWER(COALESCE(us.status, '')) LIKE '%paid%' OR LOWER(COALESCE(us.status, '')) LIKE '%pro%' OR LOWER(COALESCE(us.status, '')) LIKE '%premium%')`,
  ];

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  if (excludeEmails.length > 0) {
    const placeholders = excludeEmails.map((_, i) => `$${params.length + i + 1}`);
    excludeEmails.forEach((e) => params.push(e.toLowerCase()));
    conditions.push(`LOWER(TRIM(COALESCE(u.email, ''))) NOT IN (${placeholders.join(", ")})`);
  }

  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      us.status,
      u.created_at::date   AS joined_date,
      COUNT(up.prompt_id)  AS total_prompts,
      MAX(up.created_at)::date AS last_active
    FROM usertable u
    JOIN userstatus us ON u.user_id = us.user_id
    LEFT JOIN user_prompts up ON u.user_id = up.user_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY u.user_id, u.name, u.email, us.status, u.created_at
    ORDER BY MAX(up.created_at) DESC NULLS LAST
  `;

  return executeQuery(query, params);
}

// Deep analytics for paid users — time-of-day, DOW, intent, domain, complexity, mode, daily trend
export async function getPaidUsersAnalytics(excludeUsers = TEST_USER_IDS, excludeEmails = []) {
  const params = [];
  const conditions = [
    `(LOWER(COALESCE(us.status, '')) LIKE '%paid%' OR LOWER(COALESCE(us.status, '')) LIKE '%pro%' OR LOWER(COALESCE(us.status, '')) LIKE '%premium%')`,
  ];

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  if (excludeEmails.length > 0) {
    const placeholders = excludeEmails.map((_, i) => `$${params.length + i + 1}`);
    excludeEmails.forEach((e) => params.push(e.toLowerCase()));
    conditions.push(`LOWER(TRIM(COALESCE(u.email, ''))) NOT IN (${placeholders.join(", ")})`);
  }

  const baseJoins = `
    FROM user_prompts up
    JOIN usertable u ON up.user_id = u.user_id
    JOIN userstatus us ON up.user_id = us.user_id
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
  `;
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const hourlyQuery = `
    SELECT EXTRACT(HOUR FROM up.created_at)::int AS hour, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY hour ORDER BY hour ASC
  `;

  const dowQuery = `
    SELECT EXTRACT(DOW FROM up.created_at)::int AS dow, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY dow ORDER BY dow ASC
  `;

  const intentQuery = `
    SELECT COALESCE(NULLIF(sep.intent, ''), 'Unknown') AS intent, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY intent ORDER BY count DESC LIMIT 10
  `;

  const domainQuery = `
    SELECT COALESCE(NULLIF(sep.domain, ''), 'Unknown') AS domain, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY domain ORDER BY count DESC LIMIT 10
  `;

  const complexityQuery = `
    SELECT COALESCE(NULLIF(sep.complexity, ''), 'Unknown') AS complexity, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY complexity ORDER BY count DESC
  `;

  const modeQuery = `
    SELECT COALESCE(NULLIF(sep.mode, ''), 'Unknown') AS mode, COUNT(*) AS count
    ${baseJoins} ${whereClause}
    GROUP BY mode ORDER BY count DESC
  `;

  const tokenQuery = `
    SELECT
      ROUND(AVG(COALESCE(sep.total_token, 0)))::int AS avg_total_tokens,
      ROUND(AVG(COALESCE(sep.input_token, 0)))::int AS avg_input_tokens,
      ROUND(AVG(COALESCE(sep.output_token, 0)))::int AS avg_output_tokens,
      SUM(COALESCE(sep.total_token, 0))::bigint AS sum_tokens
    ${baseJoins} ${whereClause}
  `;

  const unknownIntentQuery = `
    SELECT
      COUNT(*)::int AS prompts,
      COUNT(*) FILTER (WHERE sep.prompt_id IS NULL)::int AS missing_enhance_row,
      COUNT(*) FILTER (
        WHERE sep.prompt_id IS NOT NULL AND sep.intent IS NULL
      )::int AS null_intent,
      COUNT(*) FILTER (
        WHERE sep.prompt_id IS NOT NULL AND BTRIM(sep.intent) = ''
      )::int AS empty_intent,
      COUNT(*) FILTER (
        WHERE sep.prompt_id IS NOT NULL AND NULLIF(BTRIM(sep.intent), '') IS NOT NULL
      )::int AS known_intent
    ${baseJoins} ${whereClause}
  `;

  // Daily trend — 90-day window; append extra param to params copy
  const dailyParams = [...params];
  dailyParams.push(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  const dateIdx = dailyParams.length;
  const dailyQuery = `
    SELECT DATE(up.created_at) AS date, COUNT(*) AS prompts, COUNT(DISTINCT up.user_id) AS active_users
    ${baseJoins} ${whereClause} AND up.created_at >= $${dateIdx}
    GROUP BY DATE(up.created_at) ORDER BY date ASC
  `;

  const [
    hourly,
    dow,
    intents,
    domains,
    complexities,
    modes,
    tokens,
    daily,
    unknownIntent,
  ] =
    await Promise.all([
      executeQuery(hourlyQuery, params),
      executeQuery(dowQuery, params),
      executeQuery(intentQuery, params),
      executeQuery(domainQuery, params),
      executeQuery(complexityQuery, params),
      executeQuery(modeQuery, params),
      executeQuery(tokenQuery, params),
      executeQuery(dailyQuery, dailyParams),
      executeQuery(unknownIntentQuery, params),
    ]);

  return {
    hourly: hourly.map((r) => ({ hour: r.hour, count: parseInt(r.count) })),
    dow: dow.map((r) => ({ dow: r.dow, count: parseInt(r.count) })),
    intents: intents.map((r) => ({ name: r.intent, value: parseInt(r.count) })),
    domains: domains.map((r) => ({ name: r.domain, value: parseInt(r.count) })),
    complexities: complexities.map((r) => ({ name: r.complexity, value: parseInt(r.count) })),
    modes: modes.map((r) => ({ name: r.mode, value: parseInt(r.count) })),
    tokens: tokens[0] || { avg_total_tokens: 0, avg_input_tokens: 0, avg_output_tokens: 0, sum_tokens: 0 },
    unknownIntent: unknownIntent[0] || {
      prompts: 0,
      missing_enhance_row: 0,
      null_intent: 0,
      empty_intent: 0,
      known_intent: 0,
    },
    daily: daily.map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      prompts: parseInt(r.prompts),
      active_users: parseInt(r.active_users),
    })),
  };
}

export async function getPaidUserBehavior(userId) {
  const params = [String(userId)];
  const baseJoins = `
    FROM user_prompts up
    JOIN usertable u ON up.user_id = u.user_id
    LEFT JOIN userstatus us ON up.user_id = us.user_id
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
  `;
  const whereClause = "WHERE up.user_id::text = $1";

  const [
    profileRows,
    summaryRows,
    dailyRows,
    intentRows,
    domainRows,
    modeRows,
    hourlyRows,
    recentRows,
    unknownRows,
  ] = await Promise.all([
    executeQuery(
      `
      SELECT
        u.user_id,
        u.name,
        u.email,
        u.created_at AS joined_at,
        u.installed,
        u.onboarding_completed,
        u.occupation,
        u.llm_platform,
        COALESCE(us.status, 'free') AS status
      FROM usertable u
      LEFT JOIN userstatus us ON u.user_id = us.user_id
      WHERE u.user_id::text = $1
      LIMIT 1
      `,
      params,
    ),
    executeQuery(
      `
      SELECT
        COUNT(up.prompt_id)::int AS prompts,
        COUNT(DISTINCT DATE(up.created_at))::int AS active_days,
        MIN(up.created_at) AS first_active,
        MAX(up.created_at) AS last_active,
        COUNT(rp.refine_id)::int AS refinements,
        ROUND(AVG(COALESCE(sep.total_token, 0)))::int AS avg_tokens,
        SUM(COALESCE(sep.total_token, 0))::bigint AS total_tokens,
        COUNT(*) FILTER (WHERE sep.enhanced_prompt_id IS NOT NULL)::int AS enhanced_prompts
      ${baseJoins}
      LEFT JOIN refine_prompt rp ON sep.enhanced_prompt_id = rp.enhanced_prompt_id
      ${whereClause}
      `,
      params,
    ),
    executeQuery(
      `
      SELECT DATE(up.created_at) AS date, COUNT(*)::int AS prompts
      ${baseJoins}
      ${whereClause}
        AND up.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(up.created_at)
      ORDER BY DATE(up.created_at) ASC
      `,
      params,
    ),
    executeQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(sep.intent), ''), 'Unknown') AS name, COUNT(*)::int AS value
      ${baseJoins} ${whereClause}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(sep.domain), ''), 'Unknown') AS name, COUNT(*)::int AS value
      ${baseJoins} ${whereClause}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(sep.mode), ''), 'Unknown') AS name, COUNT(*)::int AS value
      ${baseJoins} ${whereClause}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeQuery(
      `
      SELECT EXTRACT(HOUR FROM up.created_at)::int AS hour, COUNT(*)::int AS count
      ${baseJoins} ${whereClause}
      GROUP BY hour
      ORDER BY hour ASC
      `,
      params,
    ),
    executeQuery(
      `
      SELECT
        up.prompt_id,
        up.created_at,
        LEFT(COALESCE(up.user_prompt, ''), 240) AS prompt,
        COALESCE(NULLIF(BTRIM(sep.intent), ''), 'Unknown') AS intent,
        COALESCE(NULLIF(BTRIM(sep.mode), ''), 'Unknown') AS mode,
        COALESCE(NULLIF(BTRIM(sep.domain), ''), 'Unknown') AS domain,
        COALESCE(sep.total_token, 0)::int AS total_token,
        sep.enhanced_prompt_id IS NOT NULL AS enhanced
      ${baseJoins}
      ${whereClause}
      ORDER BY up.created_at DESC
      LIMIT 12
      `,
      params,
    ),
    executeQuery(
      `
      SELECT
        COUNT(*) FILTER (WHERE sep.prompt_id IS NULL)::int AS missing_enhance_row,
        COUNT(*) FILTER (
          WHERE sep.prompt_id IS NOT NULL AND COALESCE(NULLIF(BTRIM(sep.intent), ''), '') = ''
        )::int AS blank_intent
      ${baseJoins} ${whereClause}
      `,
      params,
    ),
  ]);

  return {
    profile: profileRows[0] || null,
    summary: summaryRows[0] || {},
    daily: dailyRows.map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      prompts: parseInt(r.prompts || 0, 10),
    })),
    intents: intentRows,
    domains: domainRows,
    modes: modeRows,
    hourly: hourlyRows.map((r) => ({
      hour: parseInt(r.hour || 0, 10),
      count: parseInt(r.count || 0, 10),
    })),
    recentPrompts: recentRows,
    unknownIntent: unknownRows[0] || { missing_enhance_row: 0, blank_intent: 0 },
  };
}

export async function getConsumerUsageForEmails(emails = [], startDate = null, endDate = null) {
  const normalizedEmails = [...new Set(
    emails
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean),
  )];

  if (normalizedEmails.length === 0) return [];

  const params = [normalizedEmails];
  const dateConditions = [];
  if (startDate) {
    params.push(startDate.toISOString());
    dateConditions.push(`up.created_at >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    dateConditions.push(`up.created_at <= $${params.length}::timestamptz`);
  }
  const dateWhere =
    dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";

  return executeQuery(
    `
    SELECT
      LOWER(TRIM(u.email)) AS email,
      u.user_id,
      u.name,
      COALESCE(us.status, 'free') AS status,
      COUNT(up.prompt_id)::int AS consumer_prompts,
      COUNT(DISTINCT DATE(up.created_at))::int AS consumer_active_days,
      MAX(up.created_at) AS consumer_last_active,
      COUNT(*) FILTER (WHERE sep.enhanced_prompt_id IS NOT NULL)::int AS consumer_enhanced_prompts,
      COALESCE(SUM(sep.total_token), 0)::bigint AS consumer_tokens
    FROM usertable u
    LEFT JOIN userstatus us ON u.user_id = us.user_id
    LEFT JOIN user_prompts up
      ON up.user_id = u.user_id
      ${dateWhere}
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
    WHERE LOWER(TRIM(u.email)) = ANY($1::text[])
    GROUP BY LOWER(TRIM(u.email)), u.user_id, u.name, us.status
    ORDER BY consumer_prompts DESC
    `,
    params,
  );
}

export async function getEnterpriseUserBehavior({
  enterpriseId,
  userId,
  startDate = null,
  endDate = null,
}) {
  const params = [String(enterpriseId), String(userId)];
  const promptDateConditions = [];
  if (startDate) {
    params.push(startDate.toISOString());
    promptDateConditions.push(`up."createdAt" >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    promptDateConditions.push(`up."createdAt" <= $${params.length}::timestamptz`);
  }
  const promptDateJoin =
    promptDateConditions.length > 0
      ? `AND ${promptDateConditions.join(" AND ")}`
      : "";

  const epDateConditions = [];
  if (startDate) epDateConditions.push(`ep."createdAt" >= $3::timestamptz`);
  if (endDate)
    epDateConditions.push(`ep."createdAt" <= $${startDate ? 4 : 3}::timestamptz`);
  const epDateWhere =
    epDateConditions.length > 0 ? `AND ${epDateConditions.join(" AND ")}` : "";

  const [
    profileRows,
    summaryRows,
    dailyRows,
    intentRows,
    domainRows,
    modeRows,
    recentRows,
  ] = await Promise.all([
    executeEnterpriseQuery(
      `
      SELECT
        u."id"::text AS "userId",
        u."name",
        u."email",
        u."isActive",
        u."createdAt" AS "joinedAt",
        e."name" AS "enterpriseName",
        e."slug" AS "enterpriseSlug"
      FROM "User" u
      JOIN "Enterprise" e ON e."id" = u."enterpriseId"
      WHERE u."enterpriseId" = $1::bigint
        AND u."id" = $2::bigint
        AND u."deletedAt" IS NULL
      LIMIT 1
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        COUNT(up."id")::int AS "enterprisePrompts",
        COUNT(DISTINCT DATE(up."createdAt"))::int AS "enterpriseActiveDays",
        MIN(up."createdAt") AS "firstActive",
        MAX(up."createdAt") AS "lastActive",
        COUNT(ep."id")::int AS "enhancedPrompts",
        ROUND(AVG(COALESCE(ep."totalToken", 0)))::int AS "avgTokens",
        COALESCE(SUM(ep."totalToken"), 0)::bigint AS "totalTokens"
      FROM "User" u
      LEFT JOIN "UserPrompt" up
        ON up."userId" = u."id"
        AND up."enterpriseId" = u."enterpriseId"
        ${promptDateJoin}
      LEFT JOIN "EnhancedPrompt" ep ON ep."promptId" = up."id"
      WHERE u."enterpriseId" = $1::bigint
        AND u."id" = $2::bigint
        AND u."deletedAt" IS NULL
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT DATE(up."createdAt") AS date, COUNT(*)::int AS prompts
      FROM "UserPrompt" up
      WHERE up."enterpriseId" = $1::bigint
        AND up."userId" = $2::bigint
        ${promptDateConditions.length > 0 ? `AND ${promptDateConditions.join(" AND ")}` : ""}
      GROUP BY DATE(up."createdAt")
      ORDER BY DATE(up."createdAt") ASC
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(ep."intent"), ''), 'Unknown') AS name, COUNT(*)::int AS value
      FROM "EnhancedPrompt" ep
      WHERE ep."enterpriseId" = $1::bigint
        AND ep."userId" = $2::bigint
        ${epDateWhere}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(ep."domain"), ''), 'Unknown') AS name, COUNT(*)::int AS value
      FROM "EnhancedPrompt" ep
      WHERE ep."enterpriseId" = $1::bigint
        AND ep."userId" = $2::bigint
        ${epDateWhere}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT COALESCE(NULLIF(BTRIM(ep."mode"), ''), 'Unknown') AS name, COUNT(*)::int AS value
      FROM "EnhancedPrompt" ep
      WHERE ep."enterpriseId" = $1::bigint
        AND ep."userId" = $2::bigint
        ${epDateWhere}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT 8
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        up."id"::text AS "promptId",
        up."createdAt",
        LEFT(COALESCE(up."userPrompt", ''), 240) AS prompt,
        COALESCE(NULLIF(BTRIM(ep."intent"), ''), 'Unknown') AS intent,
        COALESCE(NULLIF(BTRIM(ep."mode"), ''), 'Unknown') AS mode,
        COALESCE(NULLIF(BTRIM(ep."domain"), ''), 'Unknown') AS domain,
        COALESCE(ep."totalToken", 0)::int AS "totalToken",
        up."platform",
        up."source"
      FROM "UserPrompt" up
      LEFT JOIN "EnhancedPrompt" ep ON ep."promptId" = up."id"
      WHERE up."enterpriseId" = $1::bigint
        AND up."userId" = $2::bigint
        ${promptDateConditions.length > 0 ? `AND ${promptDateConditions.join(" AND ")}` : ""}
      ORDER BY up."createdAt" DESC
      LIMIT 12
      `,
      params,
    ),
  ]);

  const profile = profileRows[0] || null;
  const consumerRows = profile?.email
    ? await getConsumerUsageForEmails([profile.email], startDate, endDate)
    : [];

  return {
    profile,
    summary: summaryRows[0] || {},
    daily: dailyRows.map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      prompts: parseInt(r.prompts || 0, 10),
    })),
    intents: intentRows,
    domains: domainRows,
    modes: modeRows,
    recentPrompts: recentRows,
    consumerUsage: consumerRows[0] || null,
  };
}

// Get attrition data with filters
export async function getUserAttritionData(
  startDate,
  endDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const sourceConditions = [];

  pushPromptTableExclusionConditions(params, excludeUsers, "up").forEach((c) =>
    sourceConditions.push(c),
  );

  // Source filtering conditions (applied to prompts before aggregation)
  if (source === "Chat") {
    params.push("velocity");
    sourceConditions.push(`sep.llm_used ILIKE $${params.length}`);
  } else if (source === "Extension") {
    params.push("velocity");
    sourceConditions.push(
      `(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`,
    );
  }

  const whereClause =
    sourceConditions.length > 0
      ? `WHERE ${sourceConditions.join(" AND ")}`
      : "";

  // Date filtering conditions (applied to User Aggregates)
  // We use HAVING to filter by "First Active" date (Cohort Analysis)
  const havingConditions = [];

  if (startDate) {
    params.push(startDate.toISOString());
    havingConditions.push(`MIN(up.created_at) >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate.toISOString());
    havingConditions.push(`MIN(up.created_at) <= $${params.length}`);
  }

  const havingClause =
    havingConditions.length > 0
      ? `HAVING ${havingConditions.join(" AND ")}`
      : "";

  const query = `
    WITH UserStats AS (
      SELECT 
        up.user_id,
        COUNT(up.prompt_id) as total_prompts,
        MIN(up.created_at) as first_active,
        MAX(up.created_at) as last_active
      FROM user_prompts up
      LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
      ${whereClause}
      GROUP BY up.user_id
      ${havingClause}
    ),
    LastPrompt AS (
      SELECT DISTINCT ON (up.user_id) 
        up.user_id,
        sep.intent,
        sep.enhanced_prompt,
        sep.mode
      FROM user_prompts up
      LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
      ORDER BY up.user_id, up.created_at DESC
    )
    SELECT 
      s.user_id,
      s.total_prompts,
      s.first_active,
      s.last_active,
      l.intent as last_intent,
      l.enhanced_prompt as last_enhanced_prompt,
      l.mode as last_mode
    FROM UserStats s
    JOIN LastPrompt l ON s.user_id = l.user_id
  `;

  return executeQuery(query, params);
}

// Get conversion metrics (Onboarding & Sources)
export async function getConversionMetrics(
  startDate,
  endDate,
  source = "All",
  excludeUsers = [],
) {
  const params = [];
  const conditions = [];
  const sourceJoinConditions = [];

  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`u.created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`u.created_at <= $${params.length}`);
  }

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    conditions.push(c),
  );

  // Source filtering logic
  let joinWithPrompts = "";
  if (source === "Chat") {
    params.push("velocity");
    sourceJoinConditions.push(`sep.llm_used ILIKE $${params.length}`);
    joinWithPrompts = `
      JOIN user_prompts up ON u.user_id::text = up.user_id::text
      JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
    `;
  } else if (source === "Extension") {
    params.push("velocity");
    sourceJoinConditions.push(
      `(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`,
    );
    joinWithPrompts = `
      JOIN user_prompts up ON u.user_id = up.user_id
      JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
    `;
  }

  const whereClause =
    conditions.length > 0 || sourceJoinConditions.length > 0
      ? `WHERE ${[...conditions, ...sourceJoinConditions].join(" AND ")}`
      : "";

  // Query 1: Onboarding Completion (Distinct user_id to handle joins)
  const onboardingQuery = `
    SELECT 
        COUNT(DISTINCT u.user_id) AS total_signups,
        COUNT(DISTINCT ob.user_id) AS completed_onboarding
    FROM usertable u
    ${joinWithPrompts}
    LEFT JOIN onboarding_data ob ON u.user_id::text = ob.user_id::text
    ${whereClause}
  `;

  // Query 2: Signup Sources
  const sourcesQuery = `
    SELECT 
        COALESCE(ob.source, 'Others') as source,
        COUNT(DISTINCT u.user_id) as count
    FROM usertable u
    ${joinWithPrompts}
    LEFT JOIN onboarding_data ob ON u.user_id::text = ob.user_id::text
    ${whereClause}
    GROUP BY COALESCE(ob.source, 'Others')
    ORDER BY count DESC
  `;

  try {
    const [onboardingResult, sourcesResult] = await Promise.all([
      executeQuery(onboardingQuery, params),
      executeQuery(sourcesQuery, params),
    ]);

    const total = parseInt(onboardingResult[0]?.total_signups || "0");
    const completed = parseInt(
      onboardingResult[0]?.completed_onboarding || "0",
    );

    return {
      onboarding: {
        totalSignups: total,
        completedOnboarding: completed,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
      },
      sources: sourcesResult.map((row) => ({
        name: row.source,
        count: parseInt(row.count),
      })),
    };
  } catch (error) {
    console.error("Failed to fetch conversion metrics:", error);
    return {
      onboarding: {
        totalSignups: 0,
        completedOnboarding: 0,
        completionRate: 0,
      },
      sources: [],
    };
  }
}

// Get diagnostics data for API error logs
export async function getDiagnosticsData(startDate, endDate, source = "All") {
  const params = [];
  const conditions = [];

  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`created_at <= $${params.length}`);
  }

  // Source/Platform filter heuristics
  if (source === "Chat") {
    params.push("%chat%");
    params.push("%conversation%");
    conditions.push(
      `(api_endpoint ILIKE $${params.length - 1} OR api_endpoint ILIKE $${params.length})`,
    );
  } else if (source === "Extension") {
    params.push("%chat%");
    params.push("%conversation%");
    conditions.push(
      `(api_endpoint NOT ILIKE $${params.length - 1} AND api_endpoint NOT ILIKE $${params.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Main query to get raw logs (limit for table)
  const logsQuery = `
    SELECT 
      id,
      error_id,
      api_endpoint,
      api_method,
      error_message,
      error_type,
      user_id,
      created_at
    FROM api_error_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 200
  `;

  // Aggregation queries
  const statsQuery = `
    SELECT
      COUNT(*) as total_errors,
      COUNT(DISTINCT user_id) as affected_users,
      COUNT(DISTINCT api_endpoint) as failing_endpoints,
      COUNT(DISTINCT error_type) as error_types_count
    FROM api_error_logs
    ${whereClause}
  `;

  // Aggregation by Error Type
  const typeDistributionQuery = `
    SELECT error_type, COUNT(*) as count
    FROM api_error_logs
    ${whereClause}
    GROUP BY error_type
    ORDER BY count DESC
    LIMIT 10
  `;

  // Aggregation by Endpoint
  const endpointDistributionQuery = `
    SELECT api_endpoint, COUNT(*) as count
    FROM api_error_logs
    ${whereClause}
    GROUP BY api_endpoint
    ORDER BY count DESC
    LIMIT 10
  `;

  // Aggregation over time (Daily)
  const timeSeriesQuery = `
    SELECT 
      DATE(created_at) as date, 
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as users,
      COUNT(DISTINCT api_endpoint) as endpoints,
      COUNT(DISTINCT error_type) as types
    FROM api_error_logs
    ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  try {
    const [logs, stats, types, endpoints, timeline] = await Promise.all([
      executeQuery(logsQuery, params),
      executeQuery(statsQuery, params),
      executeQuery(typeDistributionQuery, params),
      executeQuery(endpointDistributionQuery, params),
      executeQuery(timeSeriesQuery, params),
    ]);

    return {
      logs,
      stats: stats[0] || {
        total_errors: 0,
        affected_users: 0,
        failing_endpoints: 0,
        error_types_count: 0,
      },
      distributions: {
        types,
        endpoints,
        timeline,
      },
    };
  } catch (error) {
    console.error("Failed to fetch diagnostics data:", error);
    throw error;
  }
}

// Get installation metrics (Signups, Installs, Uninstalls)
export async function getInstallationMetrics(
  startDate,
  endDate,
  excludeUsers = [],
) {
  const params = [];
  let whereConditions = [];

  if (startDate) {
    params.push(startDate.toISOString());
    whereConditions.push(`u.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    whereConditions.push(`u.created_at <= $${params.length}`);
  }

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    whereConditions.push(c),
  );

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    SELECT 
      COUNT(DISTINCT u.user_id) as total_signups,
      COUNT(DISTINCT CASE WHEN u.installed = true THEN u.user_id END) as total_installs,
      COUNT(DISTINCT CASE WHEN u.installed = false AND sep.prompt_id IS NOT NULL THEN u.user_id END) as total_uninstalls
    FROM usertable u
    LEFT JOIN user_prompts up ON u.user_id::text = up.user_id::text
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id 
        AND (sep.llm_used NOT ILIKE 'velocity' OR sep.llm_used IS NULL)
    ${whereClause}
  `;

  const rows = await executeQuery(query, params);
  return (
    rows[0] || { total_signups: 0, total_installs: 0, total_uninstalls: 0 }
  );
}

// Get daily installation metrics for visualizations
export async function getDailyInstallationMetrics(
  startDate,
  endDate,
  excludeUsers = [],
) {
  const params = [];
  let whereConditions = [];

  if (startDate) {
    params.push(startDate.toISOString());
    whereConditions.push(`u.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    whereConditions.push(`u.created_at <= $${params.length}`);
  }

  pushUsertableExclusionConditions(params, excludeUsers, "u").forEach((c) =>
    whereConditions.push(c),
  );

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // Daily signups
  const signupsQuery = `
    SELECT 
      DATE(u.created_at) as date,
      COUNT(DISTINCT u.user_id) as signups
    FROM usertable u
    ${whereClause}
    GROUP BY DATE(u.created_at)
    ORDER BY date ASC
  `;

  // Daily installs (users with installed = true, by their signup date as proxy)
  const installsQuery = `
    SELECT 
      DATE(u.created_at) as date,
      COUNT(DISTINCT CASE WHEN u.installed = true THEN u.user_id END) as installs,
      COUNT(DISTINCT CASE WHEN u.installed = false THEN u.user_id END) as uninstalls
    FROM usertable u
    LEFT JOIN user_prompts up ON u.user_id::text = up.user_id::text
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id 
        AND (sep.llm_used NOT ILIKE 'velocity' OR sep.llm_used IS NULL)
    ${whereClause}
    GROUP BY DATE(u.created_at)
    ORDER BY date ASC
  `;

  try {
    const [signupsData, installsData] = await Promise.all([
      executeQuery(signupsQuery, params),
      executeQuery(installsQuery, params),
    ]);

    // Merge the data by date
    const dateMap = {};

    signupsData.forEach((row) => {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      if (!dateMap[dateStr])
        dateMap[dateStr] = {
          date: dateStr,
          signups: 0,
          installs: 0,
          uninstalls: 0,
        };
      dateMap[dateStr].signups = parseInt(row.signups) || 0;
    });

    installsData.forEach((row) => {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      if (!dateMap[dateStr])
        dateMap[dateStr] = {
          date: dateStr,
          signups: 0,
          installs: 0,
          uninstalls: 0,
        };
      dateMap[dateStr].installs = parseInt(row.installs) || 0;
      dateMap[dateStr].uninstalls = parseInt(row.uninstalls) || 0;
    });

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error("Failed to fetch daily installation metrics:", error);
    return [];
  }
}

// Get behavior data for usage analysis (Power, Casual, Dead segments)
export async function getUsageBehaviorData(
  startDate,
  endDate,
  source = "All",
  excludeUsers = [],
) {
  const params = [];
  const conditions = [];

  pushPromptTableExclusionConditions(params, excludeUsers, "up").forEach((c) =>
    conditions.push(c),
  );
  addDateSourceFilters(params, conditions, { startDate, endDate, source });

  // For the inner UserStats CTE, Chat requires an inner JOIN to enforce source
  const innerJoin =
    source === "Chat"
      ? "JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id"
      : "LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id";

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // This query gets every prompt with its user context to calculate behavioral metrics
  const query = `
    WITH UserStats AS (
      SELECT
        up.user_id,
        COUNT(up.prompt_id) as total_prompts,
        MIN(up.created_at) as first_active,
        MAX(up.created_at) as last_active
      FROM user_prompts up
      ${innerJoin}
      ${whereClause}
      GROUP BY up.user_id
    ),
    LastPrompt AS (
      SELECT DISTINCT ON (up.user_id) 
        up.user_id,
        sep.intent,
        sep.enhanced_prompt,
        sep.mode
      FROM user_prompts up
      LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
      ORDER BY up.user_id, up.created_at DESC
    )
    SELECT 
      up.prompt_id,
      up.user_id,
      up.user_prompt,
      up.created_at,
      sep.enhanced_prompt,
      sep.mode,
      sep.llm_used,
      sep.total_token,
      rp.total_token as refine_total_token,
      CASE WHEN rp.refine_id IS NOT NULL THEN true ELSE false END as has_refinement,
      COALESCE(us.status, 'free') as user_status,
      u.name,
      u.email,
      u.created_at as user_signup_date,
      od.occupation
    FROM user_prompts up
    LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id
    LEFT JOIN refine_prompt rp ON sep.enhanced_prompt_id = rp.enhanced_prompt_id
    LEFT JOIN usertable u ON up.user_id = u.user_id
    LEFT JOIN userstatus us ON up.user_id = us.user_id
    LEFT JOIN onboarding_data od ON up.user_id = od.user_id
    ${whereClause}
    ORDER BY up.created_at DESC
  `;

  return executeQuery(query, params);
}

// Get active user breakdown by day (for combo chart)
export async function getActiveUsersBreakdown(
  startDate,
  endDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const conditions = [];

  pushPromptTableExclusionConditions(params, excludeUsers, "up").forEach((c) =>
    conditions.push(c),
  );

  // Date filtering
  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`up.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`up.created_at <= $${params.length}`);
  }

  // Source filtering
  let sourceJoin = "";
  if (source === "Chat" || source === "Extension") {
    sourceJoin =
      "LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id";
    if (source === "Chat") {
      params.push("velocity");
      conditions.push(`sep.llm_used ILIKE $${params.length}`);
    } else {
      params.push("velocity");
      conditions.push(
        `(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`,
      );
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Query: Group by date and user, then aggregate by plan
  const query = `
    WITH daily_user_prompts AS (
      SELECT 
        DATE(up.created_at) as activity_date,
        up.user_id,
        COALESCE(us.status, 'free') as plan,
        COUNT(*) as prompt_count
      FROM user_prompts up
      LEFT JOIN userstatus us ON up.user_id = us.user_id
      ${sourceJoin}
      ${whereClause}
      GROUP BY DATE(up.created_at), up.user_id, us.status
    )
    SELECT 
      activity_date as date,
      SUM(CASE WHEN LOWER(plan) = 'free' THEN 1 ELSE 0 END) as free_users,
      SUM(CASE WHEN LOWER(plan) LIKE '%trial%' THEN 1 ELSE 0 END) as trial_users,
      SUM(CASE WHEN LOWER(plan) = 'pro' OR LOWER(plan) = 'paid' OR LOWER(plan) = 'premium' THEN 1 ELSE 0 END) as pro_users,
      SUM(CASE WHEN LOWER(plan) = 'free' AND prompt_count < 5 THEN 1 ELSE 0 END) as free_lt_5,
      SUM(CASE WHEN LOWER(plan) = 'free' AND prompt_count >= 5 THEN 1 ELSE 0 END) as free_ge_5,
      SUM(CASE WHEN LOWER(plan) LIKE '%trial%' AND prompt_count < 5 THEN 1 ELSE 0 END) as trial_lt_5,
      SUM(CASE WHEN LOWER(plan) LIKE '%trial%' AND prompt_count >= 5 THEN 1 ELSE 0 END) as trial_ge_5,
      SUM(CASE WHEN (LOWER(plan) = 'pro' OR LOWER(plan) = 'paid' OR LOWER(plan) = 'premium') AND prompt_count < 5 THEN 1 ELSE 0 END) as pro_lt_5,
      SUM(CASE WHEN (LOWER(plan) = 'pro' OR LOWER(plan) = 'paid' OR LOWER(plan) = 'premium') AND prompt_count >= 5 THEN 1 ELSE 0 END) as pro_ge_5,
      COUNT(*) as total_users
    FROM daily_user_prompts
    GROUP BY activity_date
    ORDER BY activity_date ASC
  `;

  return executeQuery(query, params);
}

// Get distinct active user IDs in a period
export async function getActiveUserIds(
  startDate,
  endDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const conditions = [];

  pushPromptTableExclusionConditions(params, excludeUsers, "up").forEach((c) =>
    conditions.push(c),
  );

  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`up.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`up.created_at <= $${params.length}`);
  }

  let sourceJoin = "";
  if (source === "Chat" || source === "Extension") {
    sourceJoin =
      "LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id";
    if (source === "Chat") {
      params.push("velocity");
      conditions.push(`sep.llm_used ILIKE $${params.length}`);
    } else {
      params.push("velocity");
      conditions.push(
        `(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`,
      );
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT DISTINCT up.user_id
    FROM user_prompts up
    ${sourceJoin}
    ${whereClause}
  `;

  const rows = await executeQuery(query, params);
  return rows.map((r) => r.user_id);
}

// Get daily churn activity accurately
export async function getDailyChurnActivity(
  startDate,
  endDate,
  source = "All",
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const sourceJoinConditions = [];

  pushPromptTableExclusionConditions(params, excludeUsers, "up").forEach((c) =>
    sourceJoinConditions.push(c),
  );

  // Source filtering logic
  // We ALWAYS need to join save_enhance_prompt to check last_status (Success/Failure)
  const sourceJoin =
    "LEFT JOIN save_enhance_prompt sep ON up.prompt_id = sep.prompt_id";

  if (source === "Chat") {
    params.push("velocity");
    sourceJoinConditions.push(`sep.llm_used ILIKE $${params.length}`);
  } else if (source === "Extension") {
    params.push("velocity");
    sourceJoinConditions.push(
      `(sep.llm_used NOT ILIKE $${params.length} OR sep.llm_used IS NULL)`,
    );
  }

  const whereClause =
    sourceJoinConditions.length > 0
      ? `WHERE ${sourceJoinConditions.join(" AND ")}`
      : "";

  // We need to find users whose last_active date + 7 days falls within [startDate, endDate]
  // This means last_active falls within [startDate - 7 days, endDate - 7 days]
  const finalParams = [...params];
  let dateConditions = [];
  if (startDate) {
    const sDateParam = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    finalParams.push(sDateParam.toISOString());
    dateConditions.push(`last_active >= $${finalParams.length}`);
  }
  if (endDate) {
    const eDateParam = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    finalParams.push(eDateParam.toISOString());
    dateConditions.push(`last_active <= $${finalParams.length}`);
  }

  const dateWhere =
    dateConditions.length > 0 ? `WHERE ${dateConditions.join(" AND ")}` : "";

  const query = `
    WITH UserLastPrompt AS (
      SELECT 
        up.user_id,
        MAX(up.created_at) as last_active,
        COUNT(up.prompt_id) as total_prompts,
        CASE WHEN MAX(sep.enhanced_prompt) IS NULL OR MAX(sep.enhanced_prompt) = '' THEN 'Failure' ELSE 'Success' END as last_status
      FROM user_prompts up
      ${sourceJoin}
      ${whereClause}
      GROUP BY up.user_id
    )
    SELECT 
      (last_active + INTERVAL '7 days')::date as date,
      COUNT(*) as "churnCount",
      SUM(CASE WHEN total_prompts >= 20 THEN 1 ELSE 0 END) as "regrettableChurn",
      SUM(CASE WHEN last_status = 'Failure' THEN 1 ELSE 0 END) as "exitTriggers"
    FROM UserLastPrompt
    ${dateWhere}
    GROUP BY date
    ORDER BY date ASC
  `;

  return executeQuery(query, finalParams);
}

// Enterprise pilot insights for founder-level dashboarding
export async function getEnterprisePilotInsights(startDate, endDate, enterpriseId = null) {
  const params = [];

  if (startDate) {
    params.push(startDate.toISOString());
  }
  if (endDate) {
    params.push(endDate.toISOString());
  }
  if (enterpriseId) {
    params.push(String(enterpriseId));
  }

  const enterpriseParamIndex = enterpriseId ? params.length : null;

  const promptDateWhere = [];
  if (startDate) promptDateWhere.push(`up."createdAt" >= $1::timestamptz`);
  if (endDate)
    promptDateWhere.push(
      `up."createdAt" <= $${startDate ? 2 : 1}::timestamptz`,
    );
  if (enterpriseParamIndex) {
    promptDateWhere.push(`up."enterpriseId" = $${enterpriseParamIndex}::bigint`);
  }
  const promptWhereClause =
    promptDateWhere.length > 0 ? `WHERE ${promptDateWhere.join(" AND ")}` : "";

  const moderationDateWhere = [];
  if (startDate)
    moderationDateWhere.push(`pmr."createdAt" >= $1::timestamptz`);
  if (endDate)
    moderationDateWhere.push(
      `pmr."createdAt" <= $${startDate ? 2 : 1}::timestamptz`,
    );
  if (enterpriseParamIndex) {
    moderationDateWhere.push(
      `pmr."enterpriseId" = $${enterpriseParamIndex}::bigint`,
    );
  }
  const moderationWhereClause =
    moderationDateWhere.length > 0
      ? `WHERE ${moderationDateWhere.join(" AND ")}`
      : "";

  const queueDateWhere = [];
  if (startDate)
    queueDateWhere.push(`gaq."createdAt" >= $1::timestamptz`);
  if (endDate)
    queueDateWhere.push(
      `gaq."createdAt" <= $${startDate ? 2 : 1}::timestamptz`,
    );
  if (enterpriseParamIndex) {
    queueDateWhere.push(`gaq."enterpriseId" = $${enterpriseParamIndex}::bigint`);
  }
  const queueWhereClause =
    queueDateWhere.length > 0 ? `WHERE ${queueDateWhere.join(" AND ")}` : "";

  const [
    summaryRows,
    dailyPromptRows,
    topEnterpriseRows,
    topTeamRows,
    intentRows,
    moderationRows,
    queueRows,
    enterpriseOptionsRows,
    hourlyActivityRows,
    dowActivityRows,
    userActivityRows,
  ] = await Promise.all([
    executeEnterpriseQuery(
      `
      SELECT
        COUNT(*) FILTER (WHERE e."isActive" = true) AS "activeEnterprises",
        COUNT(*) AS "totalEnterprises",
        COUNT(*) FILTER (WHERE e."onboardingCompleted" = true) AS "onboardedEnterprises",
        COUNT(*) FILTER (WHERE e."onboardingStatus" = 'FAILED') AS "failedOnboarding",
        (
          SELECT COUNT(*)
          FROM "User" u
          WHERE u."deletedAt" IS NULL AND u."isActive" = true
          ${enterpriseParamIndex ? `AND u."enterpriseId" = $${enterpriseParamIndex}::bigint` : ""}
        ) AS "activeUsers",
        (
          SELECT COUNT(*)
          FROM "Team" t
          WHERE t."deletedAt" IS NULL
          ${enterpriseParamIndex ? `AND t."enterpriseId" = $${enterpriseParamIndex}::bigint` : ""}
        ) AS "teams",
        (
          SELECT COUNT(*)
          FROM "UserPrompt" up
          ${promptWhereClause}
        ) AS "promptsInRange",
        (
          SELECT COUNT(DISTINCT up."userId")
          FROM "UserPrompt" up
          ${promptWhereClause}
        ) AS "activePromptUsers",
        (
          SELECT COUNT(DISTINCT up."enterpriseId")
          FROM "UserPrompt" up
          ${promptWhereClause}
        ) AS "activePromptEnterprises"
      FROM "Enterprise" e
      ${enterpriseParamIndex ? `WHERE e."id" = $${enterpriseParamIndex}::bigint` : ""}
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        DATE(up."createdAt") AS date,
        COUNT(*) AS prompts,
        COUNT(DISTINCT up."userId") AS users,
        COUNT(DISTINCT up."enterpriseId") AS enterprises
      FROM "UserPrompt" up
      ${promptWhereClause}
      GROUP BY DATE(up."createdAt")
      ORDER BY DATE(up."createdAt") ASC
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        e."id" AS "enterpriseId",
        e."name" AS "enterpriseName",
        e."slug" AS "enterpriseSlug",
        COUNT(up."id") AS prompts,
        COUNT(DISTINCT up."userId") AS users
      FROM "UserPrompt" up
      JOIN "Enterprise" e ON e."id" = up."enterpriseId"
      WHERE e."isActive" = true
      ${promptWhereClause ? `AND ${promptWhereClause.replace("WHERE ", "")}` : ""}
      GROUP BY e."id", e."name"
      ORDER BY prompts DESC
      LIMIT 8
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        COALESCE(t."name", 'Unassigned') AS "teamName",
        e."name" AS "enterpriseName",
        COUNT(ep."id") AS "enhancedPrompts"
      FROM "EnhancedPrompt" ep
      JOIN "Enterprise" e ON e."id" = ep."enterpriseId"
      LEFT JOIN "Team" t ON t."id" = ep."teamId"
      WHERE e."isActive" = true
      ${enterpriseParamIndex ? `AND ep."enterpriseId" = $${enterpriseParamIndex}::bigint` : ""}
      ${startDate || endDate ? `AND ${[
        startDate ? `ep."createdAt" >= $1::timestamptz` : null,
        endDate
          ? `ep."createdAt" <= $${startDate ? 2 : 1}::timestamptz`
          : null,
      ]
        .filter(Boolean)
        .join(" AND ")}` : ""}
      GROUP BY COALESCE(t."name", 'Unassigned'), e."name"
      ORDER BY "enhancedPrompts" DESC
      LIMIT 10
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        COALESCE(NULLIF(ep."intent", ''), 'Unknown') AS intent,
        COUNT(*) AS count
      FROM "EnhancedPrompt" ep
      ${startDate || endDate || enterpriseParamIndex ? `WHERE ${[
        startDate ? `ep."createdAt" >= $1::timestamptz` : null,
        endDate
          ? `ep."createdAt" <= $${startDate ? 2 : 1}::timestamptz`
          : null,
        enterpriseParamIndex
          ? `ep."enterpriseId" = $${enterpriseParamIndex}::bigint`
          : null,
      ]
        .filter(Boolean)
        .join(" AND ")}` : ""}
      GROUP BY COALESCE(NULLIF(ep."intent", ''), 'Unknown')
      ORDER BY count DESC
      LIMIT 8
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        pmr."decisionAction" AS action,
        COUNT(*) AS count
      FROM "prompt_moderation_results" pmr
      ${moderationWhereClause}
      GROUP BY pmr."decisionAction"
      ORDER BY count DESC
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        gaq.status,
        COUNT(*) AS count
      FROM "guardrail_approval_queue" gaq
      ${queueWhereClause}
      GROUP BY gaq.status
      ORDER BY count DESC
      `,
      params,
    ),
    executeEnterpriseQuery(
      `
      SELECT
        e."id"::text AS "enterpriseId",
        e."name" AS "enterpriseName"
      FROM "Enterprise" e
      WHERE e."isActive" = true
      ORDER BY e."name" ASC
      `,
      [],
    ),
    // Hourly activity distribution
    executeEnterpriseQuery(
      `
      SELECT EXTRACT(HOUR FROM up."createdAt")::int AS hour, COUNT(*) AS count
      FROM "UserPrompt" up
      ${promptWhereClause}
      GROUP BY hour ORDER BY hour ASC
      `,
      params,
    ).catch(() => []),
    // Day-of-week activity distribution
    executeEnterpriseQuery(
      `
      SELECT EXTRACT(DOW FROM up."createdAt")::int AS dow, COUNT(*) AS count
      FROM "UserPrompt" up
      ${promptWhereClause}
      GROUP BY dow ORDER BY dow ASC
      `,
      params,
    ).catch(() => []),
    // Per-user activity — only meaningful when scoped to a single enterprise
    enterpriseParamIndex
      ? executeEnterpriseQuery(
          `
          SELECT
            u."id"::text AS "userId",
            COALESCE(u."name", '') AS "name",
            COALESCE(u."email", '') AS "email",
            u."isActive",
            u."createdAt" AS "joinedAt",
            COUNT(up."id") AS "promptCount",
            MAX(up."createdAt") AS "lastActive"
          FROM "User" u
          LEFT JOIN "UserPrompt" up
            ON up."userId" = u."id"
            ${startDate ? `AND up."createdAt" >= $1::timestamptz` : ""}
            ${endDate ? `AND up."createdAt" <= $${startDate ? 2 : 1}::timestamptz` : ""}
          WHERE u."deletedAt" IS NULL
            AND u."enterpriseId" = $${enterpriseParamIndex}::bigint
          GROUP BY u."id", u."name", u."email", u."isActive", u."createdAt"
          ORDER BY COUNT(up."id") DESC
          LIMIT 100
          `,
          params,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  const consumerUsageRows =
    enterpriseParamIndex && userActivityRows.length > 0
      ? await getConsumerUsageForEmails(
          userActivityRows.map((r) => r.email),
          startDate,
          endDate,
        ).catch(() => [])
      : [];
  const consumerUsageByEmail = new Map(
    consumerUsageRows.map((r) => [String(r.email || "").toLowerCase(), r]),
  );

  return {
    summary: summaryRows[0] || {},
    dailyPrompts: dailyPromptRows,
    topEnterprises: topEnterpriseRows,
    topTeams: topTeamRows,
    intents: intentRows,
    moderationActions: moderationRows,
    queueStatus: queueRows,
    enterpriseOptions: enterpriseOptionsRows,
    userActivity: userActivityRows.map((r) => {
      const consumerUsage = consumerUsageByEmail.get(
        String(r.email || "").toLowerCase(),
      );
      return {
        ...r,
        consumerPrompts: consumerUsage
          ? parseInt(consumerUsage.consumer_prompts || 0, 10)
          : 0,
        consumerActiveDays: consumerUsage
          ? parseInt(consumerUsage.consumer_active_days || 0, 10)
          : 0,
        consumerLastActive: consumerUsage?.consumer_last_active || null,
        consumerStatus: consumerUsage?.status || null,
        consumerUserId: consumerUsage?.user_id || null,
      };
    }),
    hourlyActivity: hourlyActivityRows.map((r) => ({ hour: r.hour, count: parseInt(r.count) })),
    dowActivity: dowActivityRows.map((r) => ({ dow: r.dow, count: parseInt(r.count) })),
  };
}

// Close pool on exit
export async function closePool() {
  await pool.end();
  if (enterprisePool && enterprisePool !== pool) {
    await enterprisePool.end();
  }
}

export default pool;
