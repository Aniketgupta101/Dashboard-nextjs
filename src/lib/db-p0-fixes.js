import { executeQuery } from "@/lib/db";
import { TEST_USER_IDS, STAKEHOLDER_EXCLUDED_NAMES_LOWER } from "@/lib/constants";

/**
 * Returns the count of users with an *active* subscription record,
 * excluding test users and internal stakeholder accounts.
 *
 * Fixes the 5.4x inflation caused by getTotalPaidUsersByDate which counts
 * all userstatus rows with status='pro' (27) instead of active subscription
 * rows (5).
 */
export async function getActivePaidUsersCount(excludeUsers = TEST_USER_IDS) {
  const params = [];

  // Stakeholder name exclusion
  const stakeholderPlaceholders = STAKEHOLDER_EXCLUDED_NAMES_LOWER.map(
    (_, i) => `$${params.length + i + 1}`,
  );
  STAKEHOLDER_EXCLUDED_NAMES_LOWER.forEach((n) => params.push(n));
  const nameClause =
    STAKEHOLDER_EXCLUDED_NAMES_LOWER.length > 0
      ? `LOWER(TRIM(COALESCE(u.name, ''))) NOT IN (${stakeholderPlaceholders.join(", ")})`
      : null;

  // Excluded user IDs
  const idPlaceholders = (excludeUsers || []).map(
    (_, i) => `$${params.length + i + 1}`,
  );
  (excludeUsers || []).forEach((id) => params.push(String(id)));
  const idClause =
    (excludeUsers || []).length > 0
      ? `u.user_id::text NOT IN (${idPlaceholders.join(", ")})`
      : null;

  const whereParts = ["s.status = 'active'"];
  if (nameClause) whereParts.push(nameClause);
  if (idClause) whereParts.push(idClause);

  const query = `
    SELECT COUNT(DISTINCT s.user_id) AS active_paid_count
    FROM subscriptions s
    JOIN usertable u ON u.user_id = s.user_id
    WHERE ${whereParts.join(" AND ")}
  `;

  const rows = await executeQuery(query, params);
  return parseInt(rows[0]?.active_paid_count ?? 0, 10);
}

/**
 * Returns per-platform enhancement success/failure breakdown.
 * Useful for identifying which client platforms have high failure rates.
 */
export async function getEnhancementFailuresByPlatform(
  startDate,
  endDate,
  excludeUsers = TEST_USER_IDS,
) {
  const params = [];
  const conditions = [];

  // Date filters
  if (startDate) {
    params.push(startDate.toISOString());
    conditions.push(`up.created_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate.toISOString());
    conditions.push(`up.created_at <= $${params.length}`);
  }

  // Stakeholder name exclusion (via usertable join alias u)
  if (STAKEHOLDER_EXCLUDED_NAMES_LOWER.length > 0) {
    const stakeholderPlaceholders = STAKEHOLDER_EXCLUDED_NAMES_LOWER.map(
      (_, i) => `$${params.length + i + 1}`,
    );
    STAKEHOLDER_EXCLUDED_NAMES_LOWER.forEach((n) => params.push(n));
    conditions.push(
      `LOWER(TRIM(COALESCE(u.name, ''))) NOT IN (${stakeholderPlaceholders.join(", ")})`,
    );
  }

  // Excluded user IDs
  if ((excludeUsers || []).length > 0) {
    const idPlaceholders = (excludeUsers || []).map(
      (_, i) => `$${params.length + i + 1}`,
    );
    (excludeUsers || []).forEach((id) => params.push(String(id)));
    conditions.push(`up.user_id::text NOT IN (${idPlaceholders.join(", ")})`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      up.platform,
      COUNT(*) AS total,
      COUNT(sep.prompt_id) AS enhanced,
      COUNT(*) - COUNT(sep.prompt_id) AS failed,
      ROUND(100.0 * COUNT(sep.prompt_id) / NULLIF(COUNT(*), 0), 1) AS success_rate
    FROM user_prompts up
    LEFT JOIN save_enhance_prompt sep ON sep.prompt_id = up.prompt_id
    JOIN usertable u ON u.user_id = up.user_id
    JOIN userstatus us ON us.user_id = up.user_id
    ${whereClause}
    GROUP BY up.platform
    ORDER BY total DESC
  `;

  return executeQuery(query, params);
}
