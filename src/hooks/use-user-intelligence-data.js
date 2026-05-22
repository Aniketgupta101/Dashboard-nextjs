"use client";

import { useState, useEffect, useCallback } from "react";

const emptyData = {
  upgradeCandidates: [],
  churnRisk: [],
  healthDistribution: [],
};

export function useUserIntelligenceData() {
  const [data, setData] = useState(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/user-intelligence");
      if (!res.ok) {
        throw new Error(`Failed to fetch user intelligence: ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setData(emptyData);
      }
    } catch (err) {
      console.error("User intelligence fetch error:", err);
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
