"use client";

import { useState, useEffect, useCallback } from "react";

export function useCohortData() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cohorts");
      if (!res.ok) {
        throw new Error(`Failed to fetch cohort data: ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Cohort fetch error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
