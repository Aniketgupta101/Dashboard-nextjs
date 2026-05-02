"use client";

import { useCallback, useEffect, useState } from "react";
import { getDateRange } from "@/lib/date-utils";

const emptyData = {
  totalEvents: 0,
  activeUsers: 0,
  eventsOverTime: [],
  topEvents: [],
  avgDailyEvents: 0,
  orgHealth: {
    promptsPerDay: [],
    dauTrend: [],
    avgDau: 0,
    engagementIndex: 0,
    trackedEventInventory: 0,
  },
  acquisition: {
    authEvents: [],
    loginFailureByType: [],
    loginMethod: [],
  },
  promptIntelligence: {
    promptSubmissions: 0,
    refinements: 0,
    refinementRate: 0,
    modelDistribution: [],
    speedModeDistribution: [],
    attachmentEvents: 0,
    attachmentRate: 0,
    starterEvents: [],
  },
  governance: {
    governanceEvents: [],
    policyToggles: [],
    flaggedOrViolationEvents: 0,
    flaggedRate: 0,
    auditLogViews: 0,
  },
  engagement: {
    personalizationSaves: 0,
    personalizationViews: 0,
    personalizationCompletionRate: 0,
    notificationReads: 0,
    notificationViews: 0,
    notificationReadRate: 0,
  },
  adminOps: {
    exportsByType: [],
    roleAtLogin: [],
  },
  meta: {},
  enterpriseOptions: [],
};

export function useEnterprisePosthogData(
  dateFilter = "Last 30 Days",
  customDateRange = undefined,
  enterpriseId = "all",
) {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range =
        dateFilter === "Custom" && customDateRange?.from && customDateRange?.to
          ? {
              startDate: customDateRange.from,
              endDate: new Date(customDateRange.to),
            }
          : getDateRange(dateFilter);

      if (range.endDate) {
        range.endDate.setHours(23, 59, 59, 999);
      }

      const params = new URLSearchParams();
      if (range.startDate) params.set("after", range.startDate.toISOString());
      if (range.endDate) params.set("before", range.endDate.toISOString());
      if (enterpriseId && enterpriseId !== "all") {
        params.set("enterpriseId", enterpriseId);
      }

      const [response, enterpriseResponse] = await Promise.all([
        fetch(`/api/enterprise-posthog?${params.toString()}`),
        fetch("/api/enterprise"),
      ]);
      const [json, enterpriseJson] = await Promise.all([
        response.json(),
        enterpriseResponse.json(),
      ]);

      if (!response.ok || !json.success) {
        throw new Error(json.error || `Failed with status ${response.status}`);
      }

      const payload = json.data || {};
      setData({
        ...emptyData,
        ...payload,
        orgHealth: { ...emptyData.orgHealth, ...payload.orgHealth },
        acquisition: { ...emptyData.acquisition, ...payload.acquisition },
        promptIntelligence: {
          ...emptyData.promptIntelligence,
          ...payload.promptIntelligence,
        },
        governance: { ...emptyData.governance, ...payload.governance },
        engagement: { ...emptyData.engagement, ...payload.engagement },
        adminOps: { ...emptyData.adminOps, ...payload.adminOps },
        meta: payload.meta || {},
        enterpriseOptions: enterpriseJson?.data?.enterpriseOptions || [],
      });
    } catch (err) {
      console.error("Enterprise PostHog fetch failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData({ ...emptyData, enterpriseOptions: [] });
    } finally {
      setIsLoading(false);
    }
  }, [customDateRange, dateFilter, enterpriseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
