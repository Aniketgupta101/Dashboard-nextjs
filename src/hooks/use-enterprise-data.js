"use client";

import { useCallback, useEffect, useState } from "react";
import { getDateRange } from "@/lib/date-utils";

const emptyData = {
  summary: {
    activeEnterprises: 0,
    totalEnterprises: 0,
    onboardedEnterprises: 0,
    failedOnboarding: 0,
    activeUsers: 0,
    teams: 0,
    promptsInRange: 0,
    activePromptUsers: 0,
    activePromptEnterprises: 0,
    onboardingRate: 0,
    enterpriseActivationRate: 0,
    promptsPerActiveUser: 0,
  },
  dailyPrompts: [],
  topEnterprises: [],
  topTeams: [],
  intents: [],
  moderationActions: [],
  queueStatus: [],
  enterpriseOptions: [],
  userActivity: [],
  hourlyActivity: [],
  dowActivity: [],
};

export function useEnterpriseData(
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
      if (range.startDate) params.set("startDate", range.startDate.toISOString());
      if (range.endDate) params.set("endDate", range.endDate.toISOString());
      if (enterpriseId && enterpriseId !== "all") {
        params.set("enterpriseId", enterpriseId);
      }

      const response = await fetch(`/api/enterprise?${params.toString()}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || `Failed with status ${response.status}`);
      }

      setData(json.data || emptyData);
    } catch (err) {
      console.error("Enterprise fetch failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(emptyData);
    } finally {
      setIsLoading(false);
    }
  }, [customDateRange, dateFilter, enterpriseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
