import { executeQuery } from "@/lib/db";
import { TEST_USER_IDS, STAKEHOLDER_EXCLUDED_NAMES_LOWER } from "@/lib/constants";

/**
 * Builds parameterized exclusion clauses and pushes values into params.
 * Returns { stakeholderClause, excludeIdsClause }
 */
function buildExclusionClauses(params, excludeUsers) {
  const names = [...STAKEHOLDER_EXCLUDED_NAMES_LOWER];
  const stakeholderPlaceholders = names.map((_, i) => `$${params.length + i + 1}`);
  names.forEach((n) => params.push(n));
  const stakeholderClause = `LOWER(TRIM(COALESCE(u.name, ''))) NOT IN (${stakeholderPlaceholders.join(", ")})`;

  const excludeIds = (excludeUsers || TEST_USER_IDS).map(String);
  const idPlaceholders = excludeIds.map((_, i) => `$${params.length + i + 1}`);
  excludeIds.forEach((id) => params.push(id));
  const excludeIdsClause = `u.user_id::text NOT IN (${idPlaceholders.join(", ")})`;

  return { stakeholderClause, excludeIdsClause };
}

/**
 * Free users most likely to upgrade, scored by a health formula.
 * Returns top 50 candidates.
 */
export async function getUpgradeCandidates(excludeUsers = TEST_USER_IDS) {
  const params = [];
  const { stakeholderClause, excludeIdsClause } = buildExclusionClauses(params, excludeUsers);

  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.occupation,
      us.status,
      COUNT(DISTINCT up.prompt_id) AS total_prompts,
      COUNT(DISTINCT DATE(up.created_at AT TIME ZONE 'Asia/Kolkata')) AS active_days,
      MAX(up.created_at AT TIME ZONE 'Asia/Kolkata') AS last_active,
      COUNT(DISTINCT CASE WHEN rp.refine_id IS NOT NULL THEN rp.refine_id END) AS refine_count,
      COUNT(DISTINCT sep.mode) AS modes_used,
      LEAST(100,
        LEAST(40, ROUND(40.0 * COUNT(DISTINCT up.prompt_id) / 50)) +
        LEAST(30, ROUND(30.0 * COUNT(DISTINCT DATE(up.created_at AT TIME ZONE 'Asia/Kolkata')) / 14)) +
        CASE WHEN MAX(up.created_at) >= NOW() - INTERVAL '7 days' THEN 20
             WHEN MAX(up.created_at) >= NOW() - INTERVAL '14 days' THEN 10
             ELSE 0 END +
        CASE WHEN COUNT(DISTINCT CASE WHEN rp.refine_id IS NOT NULL THEN rp.refine_id END) > 0 THEN 10 ELSE 0 END
      ) AS health_score
    FROM usertable u
    JOIN userstatus us ON us.user_id = u.user_id
    JOIN user_prompts up ON up.user_id = u.user_id
    LEFT JOIN save_enhance_prompt sep ON sep.prompt_id = up.prompt_id
    LEFT JOIN (
      SELECT DISTINCT ON (enhanced_prompt_id) refine_id, enhanced_prompt_id
      FROM refine_prompt ORDER BY enhanced_prompt_id, created_at DESC
    ) rp ON sep.enhanced_prompt_id = rp.enhanced_prompt_id
    WHERE us.status = 'free'
      AND ${stakeholderClause}
      AND ${excludeIdsClause}
    GROUP BY u.user_id, u.name, u.email, u.occupation, us.status
    HAVING COUNT(DISTINCT up.prompt_id) >= 3
    ORDER BY health_score DESC, total_prompts DESC
    LIMIT 50
  `;

  return executeQuery(query, params);
}

/**
 * Active users who went silent in the last 7–30 days (churn risk).
 * Returns up to 50 users ordered by days since active ascending.
 */
export async function getChurnRiskUsers(excludeUsers = TEST_USER_IDS) {
  const params = [];
  const { stakeholderClause, excludeIdsClause } = buildExclusionClauses(params, excludeUsers);

  const query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      us.status,
      COUNT(DISTINCT up.prompt_id) AS total_prompts,
      COUNT(DISTINCT DATE(up.created_at AT TIME ZONE 'Asia/Kolkata')) AS active_days,
      MAX(up.created_at AT TIME ZONE 'Asia/Kolkata') AS last_active,
      EXTRACT(DAY FROM NOW() - MAX(up.created_at)) AS days_since_active,
      MODE() WITHIN GROUP (ORDER BY sep.mode) AS most_used_mode,
      MODE() WITHIN GROUP (ORDER BY up.platform) AS most_used_platform
    FROM usertable u
    JOIN userstatus us ON us.user_id = u.user_id
    JOIN user_prompts up ON up.user_id = u.user_id
    LEFT JOIN save_enhance_prompt sep ON sep.prompt_id = up.prompt_id
    WHERE ${stakeholderClause}
      AND ${excludeIdsClause}
    GROUP BY u.user_id, u.name, u.email, us.status
    HAVING
      COUNT(DISTINCT up.prompt_id) >= 5
      AND MAX(up.created_at) < NOW() - INTERVAL '7 days'
      AND MAX(up.created_at) >= NOW() - INTERVAL '30 days'
    ORDER BY days_since_active ASC
    LIMIT 50
  `;

  return executeQuery(query, params);
}

/**
 * Segments all active users by health score into Champion / Engaged / At Risk buckets.
 * Returns [{ segment, user_count }]
 */
export async function getUserHealthDistribution(excludeUsers = TEST_USER_IDS) {
  const params = [];
  const { stakeholderClause, excludeIdsClause } = buildExclusionClauses(params, excludeUsers);

  const query = `
    SELECT
      CASE
        WHEN health_score >= 61 THEN 'Champion'
        WHEN health_score >= 31 THEN 'Engaged'
        ELSE 'At Risk'
      END AS segment,
      COUNT(*) AS user_count
    FROM (
      SELECT u.user_id,
        LEAST(100,
          LEAST(40, ROUND(40.0 * COUNT(DISTINCT up.prompt_id) / 50)) +
          LEAST(30, ROUND(30.0 * COUNT(DISTINCT DATE(up.created_at AT TIME ZONE 'Asia/Kolkata')) / 14)) +
          CASE WHEN MAX(up.created_at) >= NOW() - INTERVAL '7 days' THEN 20
               WHEN MAX(up.created_at) >= NOW() - INTERVAL '14 days' THEN 10 ELSE 0 END +
          CASE WHEN COUNT(DISTINCT rp.refine_id) > 0 THEN 10 ELSE 0 END
        ) AS health_score
      FROM usertable u
      JOIN userstatus us ON us.user_id = u.user_id
      JOIN user_prompts up ON up.user_id = u.user_id
      LEFT JOIN save_enhance_prompt sep ON sep.prompt_id = up.prompt_id
      LEFT JOIN (
        SELECT DISTINCT ON (enhanced_prompt_id) refine_id, enhanced_prompt_id
        FROM refine_prompt ORDER BY enhanced_prompt_id, created_at DESC
      ) rp ON sep.enhanced_prompt_id = rp.enhanced_prompt_id
      WHERE ${stakeholderClause}
        AND ${excludeIdsClause}
      GROUP BY u.user_id
      HAVING COUNT(DISTINCT up.prompt_id) >= 1
    ) scores
    GROUP BY segment
    ORDER BY user_count DESC
  `;

  return executeQuery(query, params);
}
