"use client";

import { useCallback, useEffect, useState } from "react";

const emptyData = {
  sendfox: {
    configured: false,
    hasToken: false,
    listIds: {},
    missingListIds: [],
  },
  cohorts: [],
  summary: {
    totalActionableUsers: 0,
    readyCohorts: 0,
  },
  sourceStatus: {
    ok: false,
    message: "Actions data has not loaded yet.",
  },
};

export function useActionCohortsData() {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/actions/cohorts");
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          json?.error || `Failed to fetch action cohorts: ${response.status}`,
        );
      }

      if (json.success && json.data) {
        setData(json.data);
        if (json.data.sourceStatus?.ok === false) {
          setError(json.data.sourceStatus.message);
        }
      } else {
        setData(emptyData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(emptyData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
