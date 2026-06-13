"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  DatabaseZap,
  Loader2,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function getDefaultQuestion(cohort) {
  return `Why are users in ${cohort?.title || "this cohort"} here, and what action should we take next?`;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || `Request failed: ${response.status}`);
  }
  return json.data;
}

export function SupermemoryPanel({ cohort }) {
  const cohortId = cohort?.id || "";
  const cohortTitle = cohort?.title || "this cohort";
  const [status, setStatus] = useState(null);
  const [question, setQuestion] = useState(getDefaultQuestion(cohort));
  const [syncResult, setSyncResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [syncError, setSyncError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/actions/supermemory/status")
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled && json?.success) setStatus(json.data);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            namespace: "thinkvelocity",
            includePii: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuestion(`Why are users in ${cohortTitle} here, and what action should we take next?`);
    setSyncResult(null);
    setAnalysisResult(null);
    setSyncError("");
    setAnalysisError("");
  }, [cohortId, cohortTitle]);

  const modeBadge = useMemo(() => {
    if (!status) return "Checking";
    return status.configured ? "Live memory" : "Demo mode";
  }, [status]);

  async function syncSelectedCohort() {
    if (!cohort?.id) return;
    setIsSyncing(true);
    setSyncError("");
    try {
      const result = await postJson("/api/actions/supermemory/sync-cohort", {
        cohortId: cohort.id,
        limit: 10,
      });
      setSyncResult(result);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function analyzeSelectedCohort() {
    if (!cohort?.id) return;
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await postJson("/api/actions/supermemory/analyze", {
        cohortId: cohort.id,
        question,
      });
      setAnalysisResult(result);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  const memorySearch = analysisResult?.memorySearch;
  const analysis = analysisResult?.analysis;

  return (
    <div className="rounded-md border bg-muted/25 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="size-4" />
            Supermemory behavior layer
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status?.configured ? "default" : "outline"}>
              {modeBadge}
            </Badge>
            <Badge variant="outline">
              {cohort?.count || 0} cohort users
            </Badge>
            {status?.includePii ? (
              <Badge variant="outline">PII enabled</Badge>
            ) : (
              <Badge variant="outline">
                <ShieldCheck className="size-3" />
                Emails redacted
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={isSyncing || !cohort?.count}
            onClick={syncSelectedCohort}
          >
            {isSyncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            Sync Memory
          </Button>
          <Button
            disabled={isAnalyzing || !cohort?.id}
            onClick={analyzeSelectedCohort}
          >
            {isAnalyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Analyze
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-h-[86px] resize-none bg-background"
        />
        <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
            <DatabaseZap className="size-3.5" />
            Memory namespace
          </div>
          <div className="font-mono">
            {syncResult?.containerTag ||
              memorySearch?.containerTag ||
              `${status?.namespace || "thinkvelocity"}:cohort:${cohort?.id || "selected"}`}
          </div>
        </div>
      </div>

      {(syncError || analysisError) && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {syncError || analysisError}
        </div>
      )}

      {syncResult && (
        <div className="mt-3 rounded-md border bg-background px-3 py-2 text-sm">
          <div className="font-medium">
            {syncResult.mode === "live"
              ? `${syncResult.syncedCount} memories queued`
              : `${syncResult.attempted} memories previewed`}
          </div>
          <div className="mt-1 text-muted-foreground">
            {syncResult.message}
          </div>
        </div>
      )}

      {analysis && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
          <div className="rounded-md border bg-background px-3 py-3">
            <div className="text-sm font-semibold">Behavior readout</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {analysis.answer}
            </p>
            {analysis.signals?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.signals.map((signal, index) => (
                  <Badge key={`${signal}-${index}`} variant="outline">
                    {signal}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border bg-background px-3 py-3">
            <div className="text-sm font-semibold">Next actions</div>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {analysis.recommendedActions?.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {memorySearch?.results?.length ? (
        <div className="mt-3 rounded-md border bg-background px-3 py-3">
          <div className="text-sm font-semibold">
            Retrieved Supermemory context
          </div>
          <div className="mt-2 grid gap-2">
            {memorySearch.results.slice(0, 3).map((result, index) => (
              <div
                key={result.id || index}
                className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                {result.memory || result.chunk}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
