import { splitName } from "@/lib/company-email";

const SENDFOX_API_BASE = "https://api.sendfox.com";

export const SENDFOX_COHORT_LIST_ENV = {
  max_users: "SENDFOX_LIST_MAX_USERS",
  free_active: "SENDFOX_LIST_FREE_ACTIVE",
  pro_subscribers: "SENDFOX_LIST_PRO_SUBSCRIBERS",
  churned_voluntary: "SENDFOX_LIST_CHURNED_VOLUNTARY",
  upgrade_candidates: "SENDFOX_LIST_UPGRADE_CANDIDATES",
  churn_risk: "SENDFOX_LIST_CHURN_RISK",
  error_affected: "SENDFOX_LIST_ERROR_AFFECTED",
  rate_limited: "SENDFOX_LIST_RATE_LIMITED",
  enterprise_prospects: "SENDFOX_LIST_ENTERPRISE_PROSPECTS",
};

function getAccessToken() {
  return process.env.SENDFOX_ACCESS_TOKEN || "";
}

export function getSendFoxConfig() {
  const token = getAccessToken();
  const listIds = Object.fromEntries(
    Object.entries(SENDFOX_COHORT_LIST_ENV).map(([cohortId, envName]) => [
      cohortId,
      process.env[envName] || "",
    ]),
  );

  const missingListIds = Object.entries(listIds)
    .filter(([, value]) => !value)
    .map(([cohortId]) => cohortId);

  return {
    configured: Boolean(token) && missingListIds.length === 0,
    hasToken: Boolean(token),
    listIds,
    missingListIds,
  };
}

function getListIdForCohort(cohortId) {
  const envName = SENDFOX_COHORT_LIST_ENV[cohortId];
  return envName ? process.env[envName] || "" : "";
}

function toSendFoxContact(user, listId) {
  const { firstName, lastName } = splitName(user.name);
  return {
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    lists: [Number(listId)],
  };
}

async function sendFoxRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("SENDFOX_ACCESS_TOKEN is not configured.");
  }

  const response = await fetch(`${SENDFOX_API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = body?.message || `SendFox request failed with ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function syncCohortToSendFox({ cohortId, users, dryRun = true }) {
  const listId = getListIdForCohort(cohortId);
  if (!listId) {
    throw new Error(`Missing SendFox list id for cohort ${cohortId}.`);
  }

  const contacts = users
    .filter((user) => user.email)
    .map((user) => toSendFoxContact(user, listId));

  if (dryRun) {
    return {
      dryRun: true,
      listId,
      contactCount: contacts.length,
      sample: contacts.slice(0, 5).map(({ email, first_name, last_name }) => ({
        email,
        first_name,
        last_name,
      })),
    };
  }

  const chunks = [];
  for (let i = 0; i < contacts.length; i += 1000) {
    chunks.push(contacts.slice(i, i + 1000));
  }

  const results = [];
  for (const chunk of chunks) {
    const result = await sendFoxRequest("/contacts/batch", {
      method: "POST",
      body: JSON.stringify({ contacts: chunk }),
    });
    results.push(result);
  }

  return {
    dryRun: false,
    listId,
    contactCount: contacts.length,
    batches: results.length,
    results,
  };
}
