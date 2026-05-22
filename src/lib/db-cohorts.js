import { executeQuery } from "@/lib/db";
import {
  TEST_USER_IDS,
  STAKEHOLDER_EXCLUDED_NAMES_LOWER,
} from "@/lib/constants";

export async function getCohortRetentionData(excludeUsers = TEST_USER_IDS) {
  const params = [];

  // Build stakeholder name exclusion
  const nameExcludePlaceholders = STAKEHOLDER_EXCLUDED_NAMES_LOWER.map(
    (_, i) => `$${params.length + i + 1}`,
  );
  STAKEHOLDER_EXCLUDED_NAMES_LOWER.forEach((n) => params.push(n));
  const nameExcludeClause =
    STAKEHOLDER_EXCLUDED_NAMES_LOWER.length > 0
      ? `LOWER(TRIM(COALESCE(u.name, ''))) NOT IN (${nameExcludePlaceholders.join(", ")})`
      : null;

  // Build user ID exclusion
  const idExcludePlaceholders = (excludeUsers || []).map(
    (_, i) => `$${params.length + i + 1}`,
  );
  (excludeUsers || []).forEach((id) => params.push(String(id)));
  const idExcludeClause =
    excludeUsers && excludeUsers.length > 0
      ? `u.user_id::text NOT IN (${idExcludePlaceholders.join(", ")})`
      : null;

  const exclusionConditions = [nameExcludeClause, idExcludeClause].filter(
    Boolean,
  );
  const exclusionWhere =
    exclusionConditions.length > 0
      ? `AND ${exclusionConditions.join(" AND ")}`
      : "";

  const query = `
    WITH cohort_signups AS (
      SELECT
        u.user_id,
        DATE_TRUNC('week', u.created_at AT TIME ZONE 'Asia/Kolkata')::date AS cohort_week
      FROM usertable u
      JOIN userstatus us ON us.user_id = u.user_id
      WHERE u.created_at >= NOW() - INTERVAL '16 weeks'
      ${exclusionWhere}
    ),
    user_activity AS (
      SELECT DISTINCT
        up.user_id,
        DATE_TRUNC('week', up.created_at AT TIME ZONE 'Asia/Kolkata')::date AS activity_week
      FROM user_prompts up
    ),
    cohort_activity AS (
      SELECT
        cs.cohort_week,
        cs.user_id,
        EXTRACT(EPOCH FROM (ua.activity_week::timestamp - cs.cohort_week::timestamp)) / 604800 AS weeks_since_signup
      FROM cohort_signups cs
      LEFT JOIN user_activity ua ON ua.user_id = cs.user_id
    )
    SELECT
      TO_CHAR(cohort_week, 'YYYY-MM-DD') AS cohort_week,
      COUNT(DISTINCT user_id) AS cohort_size,
      COUNT(DISTINCT CASE WHEN weeks_since_signup = 0 THEN user_id END) AS w0,
      COUNT(DISTINCT CASE WHEN weeks_since_signup = 1 THEN user_id END) AS w1,
      COUNT(DISTINCT CASE WHEN weeks_since_signup = 2 THEN user_id END) AS w2,
      COUNT(DISTINCT CASE WHEN weeks_since_signup = 4 THEN user_id END) AS w4,
      COUNT(DISTINCT CASE WHEN weeks_since_signup = 8 THEN user_id END) AS w8
    FROM cohort_activity
    GROUP BY cohort_week
    ORDER BY cohort_week DESC
  `;

  return executeQuery(query, params);
}
