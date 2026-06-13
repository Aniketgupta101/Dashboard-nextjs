const DEFAULT_SUPERMEMORY_API_BASE_URL = "https://api.supermemory.ai";
const DEFAULT_MEMORY_NAMESPACE = "thinkvelocity";
const MAX_SYNC_RECORDS = 25;

export function getSupermemoryBehaviorConfig() {
  return {
    configured: Boolean(process.env.SUPERMEMORY_API_KEY),
    apiKey: process.env.SUPERMEMORY_API_KEY || "",
    baseUrl:
      process.env.SUPERMEMORY_API_BASE_URL ||
      DEFAULT_SUPERMEMORY_API_BASE_URL,
    namespace:
      sanitizeContainerPart(process.env.SUPERMEMORY_NAMESPACE) ||
      DEFAULT_MEMORY_NAMESPACE,
    includePii: process.env.SUPERMEMORY_INCLUDE_PII === "true",
    dreaming: process.env.SUPERMEMORY_DREAMING_MODE || "dynamic",
  };
}

export function getSafeSupermemoryStatus() {
  const config = getSupermemoryBehaviorConfig();
  return {
    configured: config.configured,
    baseUrl: config.baseUrl,
    namespace: config.namespace,
    includePii: config.includePii,
    dreaming: config.dreaming,
  };
}

export function sanitizeContainerPart(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

export function getCohortContainerTag(cohortId) {
  const { namespace } = getSupermemoryBehaviorConfig();
  const safeCohortId = sanitizeContainerPart(cohortId) || "unknown";
  return `${namespace}:cohort:${safeCohortId}`.slice(0, 100);
}

function redactEmail(email, includePii) {
  if (!email) return "";
  if (includePii) return email;

  const [name, domain] = String(email).split("@");
  if (!domain) return "";
  const visible = name.slice(0, 1);
  return `${visible || "u"}***@${domain}`;
}

function compactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function compactMetric(label, value) {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

function getUserIdentity(user, includePii) {
  const email = redactEmail(user.email, includePii);
  const name = includePii ? user.name || "" : "";
  const parts = [
    compactMetric("user_id", user.user_id),
    name ? compactMetric("name", name) : null,
    email ? compactMetric("email", email) : null,
    compactMetric("status", user.status),
  ].filter(Boolean);
  return parts.join(", ");
}

function getBehaviorMetrics(user) {
  return [
    compactMetric("total_prompts", user.total_prompts),
    compactMetric("active_days", user.active_days),
    compactMetric("last_active", compactDate(user.last_active)),
    compactMetric("days_since_active", Math.round(user.days_since_active || 0)),
    compactMetric("error_count", user.error_count),
    compactMetric("limit_event_count", user.limit_event_count),
    compactMetric("enterprise_score", user.enterprise_score),
    compactMetric("company_domain", user.company_domain),
    compactMetric("domain_user_count", user.domain_user_count),
    compactMetric("top_endpoint", user.top_endpoint),
    compactMetric("top_error_type", user.top_error_type),
  ].filter(Boolean);
}

export function buildBehaviorMemoryRecord(cohort, user) {
  const config = getSupermemoryBehaviorConfig();
  const metrics = getBehaviorMetrics(user);
  const containerTag = getCohortContainerTag(cohort.id);
  const safeUserId = sanitizeContainerPart(user.user_id) || "unknown_user";

  return {
    containerTag,
    customId: `${containerTag}:user:${safeUserId}`.slice(0, 200),
    content: [
      "ThinkVelocity user behavior summary.",
      `Cohort: ${cohort.title} (${cohort.id}).`,
      `Priority: ${cohort.priority}.`,
      `Recommended action: ${cohort.action}.`,
      `User identity: ${getUserIdentity(user, config.includePii)}.`,
      user.reason ? `Behavior signal: ${user.reason}.` : null,
      metrics.length ? `Metrics: ${metrics.join("; ")}.` : null,
      cohort.campaign?.goal ? `Campaign goal: ${cohort.campaign.goal}.` : null,
      cohort.campaign?.tone ? `Outreach tone: ${cohort.campaign.tone}.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      source: "velo-actions",
      product: "thinkvelocity",
      cohortId: cohort.id,
      cohortTitle: cohort.title,
      priority: cohort.priority,
      status: user.status || "unknown",
      hasCompanyDomain: Boolean(user.company_domain),
    },
    userPreview: {
      user_id: user.user_id,
      name: config.includePii ? user.name || "" : "",
      email: redactEmail(user.email, config.includePii),
      status: user.status || "unknown",
      reason: user.reason || user.company_domain || user.top_error_type || "",
    },
  };
}

export function buildBehaviorMemoryRecords(cohort, limit = 10) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 10, MAX_SYNC_RECORDS));
  return (cohort.users || [])
    .slice(0, boundedLimit)
    .map((user) => buildBehaviorMemoryRecord(cohort, user));
}

async function postToSupermemory(path, body) {
  const config = getSupermemoryBehaviorConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      json?.error ||
        json?.message ||
        `Supermemory request failed with ${response.status}`,
    );
  }

  return json;
}

export async function syncCohortToSupermemory(cohort, { limit = 10 } = {}) {
  const config = getSupermemoryBehaviorConfig();
  const records = buildBehaviorMemoryRecords(cohort, limit);
  const containerTag = getCohortContainerTag(cohort.id);

  if (!config.configured) {
    return {
      mode: "demo",
      configured: false,
      containerTag,
      attempted: records.length,
      syncedCount: 0,
      queuedCount: 0,
      records: records.map((record) => record.userPreview),
      message:
        "SUPERMEMORY_API_KEY is not configured, so this preview did not leave the server.",
    };
  }

  const results = [];
  for (const record of records) {
    try {
      const result = await postToSupermemory("/v3/documents", {
        content: record.content,
        customId: record.customId,
        containerTag: record.containerTag,
        metadata: record.metadata,
        dreaming: config.dreaming,
      });
      results.push({
        ok: true,
        id: result.id,
        status: result.status || "queued",
        user: record.userPreview,
      });
    } catch (error) {
      results.push({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        user: record.userPreview,
      });
    }
  }

  return {
    mode: "live",
    configured: true,
    containerTag,
    attempted: records.length,
    syncedCount: results.filter((result) => result.ok).length,
    queuedCount: results.filter((result) => result.status === "queued").length,
    results,
    message: `Queued ${results.filter((result) => result.ok).length} behavior memories in Supermemory.`,
  };
}

export async function searchCohortMemory(cohort, question, { limit = 8 } = {}) {
  const config = getSupermemoryBehaviorConfig();
  const containerTag = getCohortContainerTag(cohort.id);

  if (!config.configured) {
    return {
      mode: "demo",
      configured: false,
      containerTag,
      results: [],
      total: 0,
      timing: null,
      message:
        "SUPERMEMORY_API_KEY is not configured, so analysis is using the local cohort snapshot.",
    };
  }

  const search = await postToSupermemory("/v4/search", {
    q: question,
    containerTag,
    searchMode: "hybrid",
    limit,
    threshold: 0.45,
  });

  return {
    mode: "live",
    configured: true,
    containerTag,
    results: search.results || [],
    total: search.total || 0,
    timing: search.timing || null,
    message: `Retrieved ${search.total || 0} relevant Supermemory results.`,
  };
}

function countBy(users, key) {
  return users.reduce((acc, user) => {
    const value = user[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(counts, limit = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function buildLocalBehaviorAnalysis(cohort, question, memorySearch = null) {
  const users = cohort.users || [];
  const topDomains = topEntries(countBy(users.filter((u) => u.company_domain), "company_domain"));
  const topStatuses = topEntries(countBy(users, "status"));
  const topSignals = users
    .map((user) => user.reason || user.company_domain || user.top_error_type)
    .filter(Boolean)
    .slice(0, 5);

  const memorySnippets = (memorySearch?.results || [])
    .map((result) => result.memory || result.chunk)
    .filter(Boolean)
    .slice(0, 5);

  return {
    question,
    answer: [
      `${cohort.title} has ${users.length} matched users and should be handled as a ${cohort.priority.toLowerCase()} motion.`,
      cohort.action ? `Primary action: ${cohort.action}.` : null,
      topDomains.length
        ? `Strongest company domains: ${topDomains
            .map((entry) => `${entry.label} (${entry.count})`)
            .join(", ")}.`
        : null,
      topStatuses.length
        ? `Status mix: ${topStatuses
            .map((entry) => `${entry.label} (${entry.count})`)
            .join(", ")}.`
        : null,
      memorySnippets.length
        ? "Supermemory retrieval found matching behavior memories; use them to personalize the outreach queue."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    recommendedActions: [
      cohort.action,
      users.length
        ? "Prioritize the first users in the cohort table; they are sorted by the strongest available signal."
        : "Connect the system database before syncing live memories.",
      topDomains.length
        ? "Group company-domain leads by account before sending founder outreach."
        : "Keep this as a user-level workflow until account clustering has enough signal.",
    ].filter(Boolean),
    signals: topSignals,
    memorySnippets,
  };
}

