import { executeQuery } from "@/lib/db";
import { TEST_USER_IDS, STAKEHOLDER_EXCLUDED_NAMES_LOWER } from "@/lib/constants";
import { getEmailDomain, isCompanyEmail } from "@/lib/company-email";
import { getSendFoxConfig } from "@/lib/sendfox";

const USER_SAMPLE_LIMIT = 100;

export const COHORT_DEFINITIONS = {
  max_users: {
    title: "Max users",
    description: "The heaviest Velocity users who should feel seen, retained, and invited to refer.",
    action: "Send anticipation early-access sequence",
    priority: "Retain + Refer",
    definition: "100 highest-usage users by prompts, active days, recency, refinements, and mode depth.",
    sourceTables: ["usertable", "userstatus", "user_prompts", "save_enhance_prompt", "refine_prompt"],
    campaign: {
      source: "ThinkVelocity_Anticipation_Copy.txt",
      segment: "Max users",
      goal: "Retain + Refer",
      tone: "Insider, personal gratitude, early access.",
      subject: "You're seeing this first, {{contact.first_name}}",
      emailPreview:
        "You use Velocity the hardest, so you get early access before the broader announcement.",
      shortMessage: "You're first in line for what's coming. Stay tuned.",
    },
  },
  free_active: {
    title: "Free users active",
    description: "Active free users who should be nudged toward Pro before the upcoming release.",
    action: "Send anticipation upgrade sequence",
    priority: "Upgrade",
    definition: "Free or free-trial users with at least 3 prompts in the last 30 days.",
    sourceTables: ["usertable", "userstatus", "user_prompts"],
    campaign: {
      source: "ThinkVelocity_Anticipation_Copy.txt",
      segment: "Free users (active)",
      goal: "Upgrade",
      tone: "Warm, curious, nudging toward the ceiling without pressure.",
      subject: "This one might change your mind, {{contact.first_name}}",
      emailPreview:
        "Something new is coming for people who want to push further than the free tier allows.",
      shortMessage: "Something new is coming. Free gets a preview. Pro gets all of it.",
    },
  },
  pro_subscribers: {
    title: "Subscribers Pro",
    description: "Paying users who should be reassured that Pro keeps getting more valuable.",
    action: "Send Pro retention sequence",
    priority: "Retain",
    definition: "Users marked Pro, with active subscription status, or with captured payment history.",
    sourceTables: ["usertable", "userstatus", "subscriptions", "payments"],
    campaign: {
      source: "ThinkVelocity_Anticipation_Copy.txt",
      segment: "Subscribers (Pro)",
      goal: "Retain",
      tone: "Quiet confidence and appreciation.",
      subject: "Your plan is about to get better",
      emailPreview:
        "No price change. The upcoming release is already included in Pro.",
      shortMessage: "Something new is coming to your plan. No extra cost. Stay tuned.",
    },
  },
  churned_voluntary: {
    title: "Churned voluntary",
    description: "Formerly active users who have gone cold and should get a founder-led win-back.",
    action: "Send anticipation win-back sequence",
    priority: "Reactivate",
    definition: "Non-Pro users with 3+ lifetime prompts and no activity for 30+ days.",
    sourceTables: ["usertable", "userstatus", "user_prompts", "subscriptions"],
    campaign: {
      source: "ThinkVelocity_Anticipation_Copy.txt",
      segment: "Churned (voluntary)",
      goal: "Reactivate",
      tone: "Honest, no guilt trip, founder reaching out personally.",
      subject: "Velocity isn't the same tool you left",
      emailPreview:
        "Acknowledge they stepped away and use the upcoming release as the reason to take a second look.",
      shortMessage:
        "Velocity isn't the tool you remember, {{contact.first_name}}. Something new is almost here.",
    },
  },
  enterprise_prospects: {
    title: "Company email prospects",
    description: "Users who signed up with non-consumer email domains and may be enterprise leads.",
    action: "Invite to schedule enterprise call",
    priority: "Enterprise",
    definition: "Users with non-consumer, non-academic domains, ranked by domain cluster and product usage.",
    sourceTables: ["usertable", "userstatus", "user_prompts"],
  },
  rate_limited: {
    title: "Rate limited",
    description: "Users who appear to have hit rate, quota, or usage-limit failures.",
    action: "Send limit education or upgrade sequence",
    priority: "Expansion",
    definition: "Users with rate, quota, 429, or usage-limit errors in the last 30 days.",
    sourceTables: ["api_error_logs", "usertable", "userstatus"],
  },
  error_affected: {
    title: "Recent error affected",
    description: "Users who hit recent API errors and may need support outreach.",
    action: "Send support recovery sequence",
    priority: "Support",
    definition: "Users with linked API errors in the last 14 days.",
    sourceTables: ["api_error_logs", "usertable", "userstatus"],
  },
  churn_risk: {
    title: "Churn risk",
    description: "Previously active users who have gone silent in the last 7-30 days.",
    action: "Send reactivation sequence",
    priority: "Retention",
    definition: "Users with 5+ lifetime prompts, last active 7-30 days ago.",
    sourceTables: ["usertable", "userstatus", "user_prompts"],
  },
  upgrade_candidates: {
    title: "Upgrade candidates",
    description: "Free users with enough activation to justify a founder-led upgrade nudge.",
    action: "Send upgrade sequence",
    priority: "Revenue",
    definition: "Free users with 3+ prompts, recent activity, and strong product-health score.",
    sourceTables: ["usertable", "userstatus", "user_prompts", "save_enhance_prompt", "refine_prompt"],
  },
};

function buildUserExclusionClauses(params, alias = "u") {
  const clauses = [];

  if (TEST_USER_IDS.length) {
    const placeholders = TEST_USER_IDS.map((_, i) => `$${params.length + i + 1}`);
    TEST_USER_IDS.forEach((id) => params.push(String(id)));
    clauses.push(`${alias}.user_id::text NOT IN (${placeholders.join(", ")})`);
  }

  if (STAKEHOLDER_EXCLUDED_NAMES_LOWER.length) {
    const placeholders = STAKEHOLDER_EXCLUDED_NAMES_LOWER.map(
      (_, i) => `$${params.length + i + 1}`,
    );
    STAKEHOLDER_EXCLUDED_NAMES_LOWER.forEach((name) => params.push(name));
    clauses.push(
      `LOWER(TRIM(COALESCE(${alias}.name, ''))) NOT IN (${placeholders.join(", ")})`,
    );
  }

  return clauses;
}

function toNumber(value) {
  return Number(value || 0);
}

function normalizeStatus(status) {
  return String(status || "free").toLowerCase();
}

function daysSince(dateValue) {
  if (!dateValue) return null;
  const elapsed = Date.now() - new Date(dateValue).getTime();
  if (!Number.isFinite(elapsed)) return null;
  return Math.max(0, Math.floor(elapsed / 86400000));
}

function calculateHealthScore(user) {
  const totalPromptsScore = Math.min(30, Math.round((user.total_prompts / 100) * 30));
  const activeDaysScore = Math.min(25, Math.round((user.active_days / 30) * 25));
  const recencyScore =
    user.days_since_active === null
      ? 0
      : user.days_since_active <= 7
        ? 25
        : user.days_since_active <= 14
          ? 18
          : user.days_since_active <= 30
            ? 10
            : 0;
  const refinementScore = Math.min(10, Math.round((user.refine_count / 20) * 10));
  const depthScore = Math.min(10, user.modes_used * 2);

  return Math.min(
    100,
    totalPromptsScore + activeDaysScore + recencyScore + refinementScore + depthScore,
  );
}

function calculateEnterpriseScore(user) {
  if (!user.is_company_email) return 0;
  return Math.min(
    100,
    35 +
      Math.min(25, user.total_prompts * 3) +
      Math.min(20, user.active_days * 4) +
      Math.min(20, user.domain_user_count * 8),
  );
}

function normalizeUserFact(row, domainCounts) {
  const status = normalizeStatus(row.status);
  const activeSubscriptionCount = toNumber(row.active_subscription_count);
  const capturedPaymentCount = toNumber(row.captured_payment_count);
  const companyDomain = getEmailDomain(row.email);
  const lastActive = row.last_active || null;

  const user = {
    user_id: row.user_id,
    name: row.name || "",
    email: row.email || "",
    status,
    occupation: row.occupation || "",
    signed_up_at: row.signed_up_at || null,
    installed: Boolean(row.installed),
    email_verified: Boolean(row.email_verified),
    total_prompts: toNumber(row.total_prompts),
    prompts_7d: toNumber(row.prompts_7d),
    prompts_14d: toNumber(row.prompts_14d),
    prompts_30d: toNumber(row.prompts_30d),
    active_days: toNumber(row.active_days),
    active_days_30d: toNumber(row.active_days_30d),
    first_prompt_at: row.first_prompt_at || null,
    last_active: lastActive,
    days_since_active: daysSince(lastActive),
    refine_count: toNumber(row.refine_count),
    modes_used: toNumber(row.modes_used),
    most_used_mode: row.most_used_mode || "",
    most_used_platform: row.most_used_platform || "",
    total_tokens: toNumber(row.total_tokens),
    error_events_14d: toNumber(row.error_events_14d),
    error_events_30d: toNumber(row.error_events_30d),
    rate_limit_events_30d: toNumber(row.rate_limit_events_30d),
    last_error_at: row.last_error_at || null,
    top_error_type: row.top_error_type || "",
    top_error_endpoint: row.top_error_endpoint || "",
    subscription_status: row.subscription_status || "",
    active_subscription_count: activeSubscriptionCount,
    canceled_subscription_count: toNumber(row.canceled_subscription_count),
    captured_payment_count: capturedPaymentCount,
    failed_payment_count: toNumber(row.failed_payment_count),
    last_payment_at: row.last_payment_at || null,
    company_domain: companyDomain,
    is_company_email: isCompanyEmail(row.email),
    domain_user_count: companyDomain ? domainCounts[companyDomain] || 0 : 0,
  };

  user.is_pro = status === "pro" || activeSubscriptionCount > 0 || capturedPaymentCount > 0;
  user.health_score = calculateHealthScore(user);
  user.enterprise_score = calculateEnterpriseScore(user);
  user.activity_score =
    user.total_prompts * 2 +
    user.active_days * 6 +
    user.prompts_30d * 4 +
    user.refine_count * 3 +
    user.modes_used * 8 +
    (user.days_since_active !== null && user.days_since_active <= 7 ? 40 : 0);

  return user;
}

export async function getActionUserFacts() {
  const params = [];
  const exclusions = buildUserExclusionClauses(params, "u");
  const whereClause = [
    "u.email IS NOT NULL",
    "POSITION('@' IN u.email) > 1",
    ...exclusions,
  ].join(" AND ");

  const query = `
    WITH prompt_stats AS (
      SELECT
        up.user_id::text AS user_id,
        COUNT(DISTINCT up.prompt_id) AS total_prompts,
        COUNT(DISTINCT CASE WHEN up.created_at >= NOW() - INTERVAL '7 days' THEN up.prompt_id END) AS prompts_7d,
        COUNT(DISTINCT CASE WHEN up.created_at >= NOW() - INTERVAL '14 days' THEN up.prompt_id END) AS prompts_14d,
        COUNT(DISTINCT CASE WHEN up.created_at >= NOW() - INTERVAL '30 days' THEN up.prompt_id END) AS prompts_30d,
        COUNT(DISTINCT DATE(up.created_at AT TIME ZONE 'Asia/Kolkata')) AS active_days,
        COUNT(DISTINCT CASE WHEN up.created_at >= NOW() - INTERVAL '30 days' THEN DATE(up.created_at AT TIME ZONE 'Asia/Kolkata') END) AS active_days_30d,
        MIN(up.created_at AT TIME ZONE 'Asia/Kolkata') AS first_prompt_at,
        MAX(up.created_at AT TIME ZONE 'Asia/Kolkata') AS last_active,
        COUNT(DISTINCT rp.refine_id) AS refine_count,
        COUNT(DISTINCT sep.mode) AS modes_used,
        MODE() WITHIN GROUP (ORDER BY sep.mode) AS most_used_mode,
        MODE() WITHIN GROUP (ORDER BY up.platform) AS most_used_platform,
        COALESCE(SUM(COALESCE(sep.total_token, 0) + COALESCE(rp.total_token, 0)), 0) AS total_tokens
      FROM user_prompts up
      LEFT JOIN save_enhance_prompt sep ON sep.prompt_id = up.prompt_id
      LEFT JOIN refine_prompt rp ON rp.prompt_id = up.prompt_id
      GROUP BY up.user_id::text
    ),
    error_stats AS (
      SELECT
        e.user_id::text AS user_id,
        COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '14 days') AS error_events_14d,
        COUNT(*) FILTER (WHERE e.created_at >= NOW() - INTERVAL '30 days') AS error_events_30d,
        COUNT(*) FILTER (
          WHERE e.created_at >= NOW() - INTERVAL '30 days'
            AND (
              e.error_message ILIKE '%rate limit%'
              OR e.error_message ILIKE '%rate-limit%'
              OR e.error_message ILIKE '%429%'
              OR e.error_message ILIKE '%quota%'
              OR e.error_message ILIKE '%usage limit%'
              OR e.error_type ILIKE '%rate%'
              OR e.error_type ILIKE '%limit%'
            )
        ) AS rate_limit_events_30d,
        MAX(e.created_at AT TIME ZONE 'Asia/Kolkata') AS last_error_at,
        MODE() WITHIN GROUP (ORDER BY e.error_type) AS top_error_type,
        MODE() WITHIN GROUP (ORDER BY e.api_endpoint) AS top_error_endpoint
      FROM api_error_logs e
      WHERE e.user_id IS NOT NULL
      GROUP BY e.user_id::text
    ),
    subscription_stats AS (
      SELECT
        s.user_id::text AS user_id,
        MODE() WITHIN GROUP (ORDER BY s.status) AS subscription_status,
        COUNT(*) FILTER (WHERE LOWER(s.status) = 'active') AS active_subscription_count,
        COUNT(*) FILTER (WHERE LOWER(s.status) IN ('canceled', 'halted')) AS canceled_subscription_count
      FROM subscriptions s
      GROUP BY s.user_id::text
    ),
    payment_stats AS (
      SELECT
        p.user_id::text AS user_id,
        COUNT(*) FILTER (WHERE LOWER(p.status) = 'captured') AS captured_payment_count,
        COUNT(*) FILTER (WHERE LOWER(p.status) = 'failed') AS failed_payment_count,
        MAX(p.created_at AT TIME ZONE 'Asia/Kolkata') AS last_payment_at
      FROM payments p
      GROUP BY p.user_id::text
    )
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.occupation,
      u.installed,
      u.email_verified,
      u.created_at AT TIME ZONE 'Asia/Kolkata' AS signed_up_at,
      COALESCE(us.status, 'free') AS status,
      COALESCE(ps.total_prompts, 0) AS total_prompts,
      COALESCE(ps.prompts_7d, 0) AS prompts_7d,
      COALESCE(ps.prompts_14d, 0) AS prompts_14d,
      COALESCE(ps.prompts_30d, 0) AS prompts_30d,
      COALESCE(ps.active_days, 0) AS active_days,
      COALESCE(ps.active_days_30d, 0) AS active_days_30d,
      ps.first_prompt_at,
      ps.last_active,
      COALESCE(ps.refine_count, 0) AS refine_count,
      COALESCE(ps.modes_used, 0) AS modes_used,
      ps.most_used_mode,
      ps.most_used_platform,
      COALESCE(ps.total_tokens, 0) AS total_tokens,
      COALESCE(es.error_events_14d, 0) AS error_events_14d,
      COALESCE(es.error_events_30d, 0) AS error_events_30d,
      COALESCE(es.rate_limit_events_30d, 0) AS rate_limit_events_30d,
      es.last_error_at,
      es.top_error_type,
      es.top_error_endpoint,
      ss.subscription_status,
      COALESCE(ss.active_subscription_count, 0) AS active_subscription_count,
      COALESCE(ss.canceled_subscription_count, 0) AS canceled_subscription_count,
      COALESCE(pay.captured_payment_count, 0) AS captured_payment_count,
      COALESCE(pay.failed_payment_count, 0) AS failed_payment_count,
      pay.last_payment_at
    FROM usertable u
    LEFT JOIN userstatus us ON us.user_id::text = u.user_id::text
    LEFT JOIN prompt_stats ps ON ps.user_id = u.user_id::text
    LEFT JOIN error_stats es ON es.user_id = u.user_id::text
    LEFT JOIN subscription_stats ss ON ss.user_id = u.user_id::text
    LEFT JOIN payment_stats pay ON pay.user_id = u.user_id::text
    WHERE ${whereClause}
  `;

  const rows = await executeQuery(query, params);
  const domainCounts = rows.reduce((acc, row) => {
    const domain = getEmailDomain(row.email);
    if (domain && isCompanyEmail(row.email)) {
      acc[domain] = (acc[domain] || 0) + 1;
    }
    return acc;
  }, {});

  return rows.map((row) => normalizeUserFact(row, domainCounts));
}

function compareDesc(field) {
  return (left, right) => toNumber(right[field]) - toNumber(left[field]);
}

function compareDateDesc(field) {
  return (left, right) => {
    const rightDate = right[field] ? new Date(right[field]).getTime() : 0;
    const leftDate = left[field] ? new Date(left[field]).getTime() : 0;
    return rightDate - leftDate;
  };
}

function shapeUserForCohort(user, cohortId) {
  const shaped = {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    status: user.status,
    company_domain: user.company_domain,
    last_active: user.last_active,
    health_score: user.health_score,
    score: user.health_score,
    metrics: {
      total_prompts: user.total_prompts,
      prompts_30d: user.prompts_30d,
      active_days: user.active_days,
      active_days_30d: user.active_days_30d,
      refine_count: user.refine_count,
      modes_used: user.modes_used,
      error_events_14d: user.error_events_14d,
      rate_limit_events_30d: user.rate_limit_events_30d,
      days_since_active: user.days_since_active,
      domain_user_count: user.domain_user_count,
    },
  };

  if (cohortId === "enterprise_prospects") {
    return {
      ...shaped,
      score: user.enterprise_score,
      reason:
        user.domain_user_count > 1
          ? `${user.domain_user_count} users from ${user.company_domain}; ${user.total_prompts} prompts`
          : `${user.company_domain}; ${user.total_prompts} prompts`,
    };
  }

  if (cohortId === "rate_limited") {
    return {
      ...shaped,
      score: user.rate_limit_events_30d,
      reason: `${user.rate_limit_events_30d} limit events in 30d; ${user.top_error_endpoint || "endpoint unknown"}`,
    };
  }

  if (cohortId === "error_affected") {
    return {
      ...shaped,
      score: user.error_events_14d,
      reason: `${user.error_events_14d} errors in 14d; ${user.top_error_type || "type unknown"}`,
    };
  }

  if (cohortId === "churn_risk" || cohortId === "churned_voluntary") {
    return {
      ...shaped,
      score: user.days_since_active || 0,
      reason: `Inactive ${user.days_since_active}d; ${user.total_prompts} prompts, ${user.active_days} active days`,
    };
  }

  if (cohortId === "pro_subscribers") {
    return {
      ...shaped,
      score: user.health_score,
      reason: `${user.total_prompts} prompts; ${user.active_subscription_count} active subs; ${user.captured_payment_count} captured payments`,
    };
  }

  if (cohortId === "free_active") {
    return {
      ...shaped,
      score: user.health_score,
      reason: `${user.prompts_30d} prompts in 30d; ${user.active_days_30d} active days in 30d`,
    };
  }

  return {
    ...shaped,
    score: user.health_score,
    reason: `${user.total_prompts} prompts, ${user.active_days} active days, health ${user.health_score}`,
  };
}

function buildCohort(id, allUsers, predicate, sorter) {
  const config = getSendFoxConfig();
  const definition = COHORT_DEFINITIONS[id];
  const matches = allUsers.filter(predicate).sort(sorter);
  const shapedUsers = matches.map((user) => shapeUserForCohort(user, id));

  return {
    id,
    ...definition,
    count: matches.length,
    displayedCount: Math.min(matches.length, USER_SAMPLE_LIMIT),
    sampleLimit: USER_SAMPLE_LIMIT,
    sendfoxListId: config.listIds[id] || null,
    sendfoxReady: Boolean(config.hasToken && config.listIds[id]),
    users: shapedUsers,
    truth: {
      matchedUsers: matches.length,
      displayedUsers: Math.min(matches.length, USER_SAMPLE_LIMIT),
      sourceTables: definition.sourceTables,
      definition: definition.definition,
    },
  };
}

export async function getActionCohorts() {
  const users = await getActionUserFacts();

  const maxUserCutoff = [...users]
    .filter((user) => user.total_prompts > 0)
    .sort(compareDesc("activity_score"))
    .slice(0, USER_SAMPLE_LIMIT)
    .at(-1)?.activity_score ?? Infinity;

  const cohorts = [
    buildCohort(
      "max_users",
      users,
      (user) => user.total_prompts > 0 && user.activity_score >= maxUserCutoff,
      compareDesc("activity_score"),
    ),
    buildCohort(
      "free_active",
      users,
      (user) =>
        ["free", "freetrial"].includes(user.status) &&
        user.prompts_30d >= 3 &&
        !user.is_pro,
      compareDateDesc("last_active"),
    ),
    buildCohort(
      "pro_subscribers",
      users,
      (user) => user.is_pro,
      compareDateDesc("last_active"),
    ),
    buildCohort(
      "churned_voluntary",
      users,
      (user) =>
        !user.is_pro &&
        user.total_prompts >= 3 &&
        user.days_since_active !== null &&
        user.days_since_active >= 30,
      compareDesc("days_since_active"),
    ),
    buildCohort(
      "enterprise_prospects",
      users,
      (user) => user.is_company_email,
      compareDesc("enterprise_score"),
    ),
    buildCohort(
      "rate_limited",
      users,
      (user) => user.rate_limit_events_30d > 0,
      compareDesc("rate_limit_events_30d"),
    ),
    buildCohort(
      "error_affected",
      users,
      (user) => user.error_events_14d > 0,
      compareDesc("error_events_14d"),
    ),
    buildCohort(
      "churn_risk",
      users,
      (user) =>
        user.total_prompts >= 5 &&
        user.days_since_active !== null &&
        user.days_since_active >= 7 &&
        user.days_since_active <= 30,
      compareDesc("days_since_active"),
    ),
    buildCohort(
      "upgrade_candidates",
      users,
      (user) =>
        ["free", "freetrial"].includes(user.status) &&
        !user.is_pro &&
        user.total_prompts >= 3 &&
        user.health_score >= 35 &&
        user.days_since_active !== null &&
        user.days_since_active <= 30,
      compareDesc("health_score"),
    ),
  ];

  const uniqueActionableUserIds = new Set(
    cohorts.flatMap((cohort) => cohort.users.map((user) => String(user.user_id))),
  );

  return {
    sendfox: getSendFoxConfig(),
    sourceStatus: {
      ok: true,
      message: "System database connected.",
    },
    generatedAt: new Date().toISOString(),
    model: {
      userFactCount: users.length,
      sampleLimit: USER_SAMPLE_LIMIT,
      complexity: "One SQL fact scan plus O(n log n) ranking per cohort over the in-memory user fact set.",
    },
    cohorts,
    summary: {
      totalActionableUsers: cohorts.reduce((sum, cohort) => sum + cohort.count, 0),
      uniqueDisplayedUsers: uniqueActionableUserIds.size,
      readyCohorts: cohorts.filter((cohort) => cohort.sendfoxReady).length,
    },
  };
}

export function getEmptyActionCohorts(sourceStatus) {
  const sendfox = getSendFoxConfig();
  const cohorts = Object.entries(COHORT_DEFINITIONS).map(([id, definition]) => ({
    id,
    ...definition,
    count: 0,
    displayedCount: 0,
    sampleLimit: USER_SAMPLE_LIMIT,
    sendfoxListId: sendfox.listIds[id] || null,
    sendfoxReady: Boolean(sendfox.hasToken && sendfox.listIds[id]),
    users: [],
    truth: {
      matchedUsers: 0,
      displayedUsers: 0,
      sourceTables: definition.sourceTables,
      definition: definition.definition,
    },
  }));

  return {
    sendfox,
    sourceStatus,
    generatedAt: new Date().toISOString(),
    model: {
      userFactCount: 0,
      sampleLimit: USER_SAMPLE_LIMIT,
      complexity: "No database fact scan was run because the data source is unavailable.",
    },
    cohorts,
    summary: {
      totalActionableUsers: 0,
      uniqueDisplayedUsers: 0,
      readyCohorts: cohorts.filter((cohort) => cohort.sendfoxReady).length,
    },
  };
}

export async function getActionCohortById(cohortId) {
  const data = await getActionCohorts();
  return data.cohorts.find((cohort) => cohort.id === cohortId) || null;
}
