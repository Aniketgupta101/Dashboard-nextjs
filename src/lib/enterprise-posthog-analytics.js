/**
 * Velocity Enterprise PostHog analytics — HogQL helpers aligned with the
 * platform event matrix (auth, chat, history, governance, admin).
 */

/** Product events from the spec (Section 3); extend as instrumentation grows. */
export const VELOCITY_EVENT_GROUPS = {
  auth: [
    "page_viewed_landing",
    "cta_clicked_register",
    "cta_clicked_login",
    "admin_registered",
    "login_success",
    "login_failed",
    "logout",
    "password_changed",
    "workspace_switched",
  ],
  chat: [
    "chat_opened",
    "new_chat_clicked",
    "prompt_typed",
    "model_speed_selected",
    "file_attached",
    "prompt_submitted",
    "prompt_response_received",
    "prompt_refinement_submitted",
    "starter_prompt_viewed",
    "starter_prompt_shuffle_clicked",
    "starter_prompt_selected",
    "teams_filter_changed",
  ],
  history: [
    "history_tab_viewed",
    "history_search_performed",
    "history_tab_switched",
    "enterprise_history_toggled",
    "prompt_collection_saved",
    "audit_log_viewed",
    "review_queue_item_actioned",
    "csv_exported",
    "view_mode_switched",
  ],
  personalization: [
    "personalization_viewed",
    "personalization_name_set",
    "personalization_work_type_set",
    "personalization_style_tag_added",
    "personalization_output_type_set",
    "personalization_profile_saved",
  ],
  usersTeams: [
    "users_teams_viewed",
    "users_tab_switched",
    "user_search_performed",
    "add_user_clicked",
    "user_invited",
    "user_role_changed",
    "user_permission_changed",
    "user_status_changed",
    "create_team_clicked",
    "team_created",
    "team_edited",
    "team_deleted",
    "team_viewed",
  ],
  policy: [
    "policy_center_viewed",
    "policy_tab_switched",
    "data_protection_rule_toggled",
    "tool_access_toggled",
    "policy_uploaded",
  ],
  projectPolicy: [
    "project_policy_viewed",
    "file_upload_initiated",
    "file_upload_success",
    "file_upload_failed",
    "upload_search_performed",
    "upload_date_filter_changed",
  ],
  notifications: [
    "notifications_viewed",
    "notification_read",
    "notifications_paginated",
  ],
  governance: [
    "prompt_flagged_by_system",
    "intelligence_alert_shown",
    "vygr_brand_safety_flag_triggered",
    "vygr_pii_detected",
    "vygr_api_key_blocked",
    "vygr_review_queue_submitted",
    "vygr_review_queue_resolved",
  ],
};

export function allTrackedEventNames() {
  return [
    ...new Set(Object.values(VELOCITY_EVENT_GROUPS).flat()),
  ];
}

export function sqlEventInList(events) {
  if (!events.length) return "1=0";
  const escaped = events.map((e) => `'${String(e).replace(/'/g, "''")}'`);
  return `event IN (${escaped.join(", ")})`;
}

export function sqlTimestampRange(dateFrom, dateTo) {
  const parts = [];
  if (dateFrom) {
    parts.push(
      `timestamp >= '${dateFrom}'`,
    );
  }
  if (dateTo) {
    parts.push(`timestamp <= '${dateTo}'`);
  }
  return parts.length ? parts.join(" AND ") : "1=1";
}

/** Enterprise / org scoping on JSON properties (matches dashboard filters). */
export function sqlEnterpriseScope(safeEnterpriseId) {
  if (!safeEnterpriseId) return "1=1";
  return `(
    JSONExtractString(properties, 'enterpriseId') = '${safeEnterpriseId}'
    OR JSONExtractString(properties, 'enterprise_id') = '${safeEnterpriseId}'
    OR JSONExtractString(properties, 'enterprise') = '${safeEnterpriseId}'
    OR JSONExtractString(properties, 'org_id') = '${safeEnterpriseId}'
    OR JSONExtractString(properties, 'workspace_id') = '${safeEnterpriseId}'
  )`;
}

export function sqlNoiseExclusion() {
  return `event NOT IN ('$snapshot', '$feature_flag_called')`;
}
