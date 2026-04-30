"use client";

import { useCallback, useEffect, useState } from "react";
import { getDateRange } from "@/lib/date-utils";

const emptyData = {
  totalEvents: 0,
  activeUsers: 0,
  eventsOverTime: [],
  topEvents: [],
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

      setData({
        ...(json.data || emptyData),
        enterpriseOptions: enterpriseJson?.data?.enterpriseOptions || [],
      });
    } catch (err) {
      console.error("Enterprise PostHog fetch failed:", err);
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
