"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Crown,
  MailCheck,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserMinus,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionCohortsData } from "@/hooks/use-action-cohorts-data";
import { SupermemoryPanel } from "@/components/actions/supermemory-panel";

const iconByCohort = {
  max_users: Sparkles,
  free_active: Users,
  pro_subscribers: Crown,
  churned_voluntary: UserMinus,
  enterprise_prospects: Building2,
  rate_limited: Zap,
  error_affected: ShieldAlert,
  churn_risk: UserMinus,
  upgrade_candidates: MailCheck,
};

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function UserRows({ users }) {
  const visibleUsers = users.slice(0, 12);
  return (
    <ScrollArea className="h-[320px] rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Last active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleUsers.length ? (
            visibleUsers.map((user) => (
              <TableRow key={`${user.user_id}-${user.email}`}>
                <TableCell className="font-medium max-w-[180px] truncate">
                  {formatValue(user.name)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[260px] truncate">
                  {formatValue(user.email)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatValue(user.status)}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatValue(user.score)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[320px] truncate">
                  {formatValue(
                    user.reason ||
                      user.company_domain ||
                      user.top_error_type ||
                      user.most_used_platform,
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {user.last_active
                    ? new Date(user.last_active).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "-"}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No users currently match this cohort.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function ActionsPage() {
  const { data, isLoading, error, refetch } = useActionCohortsData();
  const [selectedId, setSelectedId] = useState("max_users");
  const [syncState, setSyncState] = useState({});

  const selectedCohort = useMemo(
    () => data.cohorts.find((cohort) => cohort.id === selectedId) || data.cohorts[0],
    [data.cohorts, selectedId],
  );

  async function syncCohort(cohortId, dryRun) {
    setSyncState((state) => ({
      ...state,
      [cohortId]: { loading: true, message: dryRun ? "Previewing..." : "Syncing..." },
    }));

    try {
      const response = await fetch("/api/actions/sendfox/sync-cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, dryRun }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || `SendFox sync failed: ${response.status}`);
      }
      const count = json.data?.result?.contactCount || 0;
      setSyncState((state) => ({
        ...state,
        [cohortId]: {
          loading: false,
          message: dryRun
            ? `Preview ready: ${count} contacts would sync.`
            : `Synced ${count} contacts to SendFox.`,
        },
      }));
    } catch (err) {
      setSyncState((state) => ({
        ...state,
        [cohortId]: {
          loading: false,
          message: err instanceof Error ? err.message : "SendFox sync failed.",
        },
      }));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Actions
          </h1>
          <p className="mt-2 text-muted-foreground text-sm md:text-base">
            Turn user behavior, errors, limits, churn risk, and company emails into outreach queues.
          </p>
        </div>
        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {(error || data.sourceStatus?.ok === false) && (
        <Card className="rounded-lg border-yellow-500/40 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="size-4" />
              Database not connected
            </CardTitle>
            <CardDescription>
              Add the consume database env vars, then restart the dev server. The page is ready, but cohorts cannot be calculated until the system database is available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
              CONSUME_DATABASE_URL or CONSUME_DB_HOST, CONSUME_DB_USER, CONSUME_DB_PASSWORD, CONSUME_DB_PORT, CONSUME_DB_NAME
            </code>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{data.summary.totalActionableUsers.toLocaleString()}</CardTitle>
            <CardDescription>Actionable cohort matches</CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{(data.summary.uniqueDisplayedUsers || 0).toLocaleString()}</CardTitle>
            <CardDescription>Unique users across cohorts</CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{data.summary.readyCohorts}</CardTitle>
            <CardDescription>SendFox-ready cohorts</CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-yellow-500" />
              SendFox setup
            </CardTitle>
            <CardDescription>
              {data.sendfox.hasToken
                ? "Token is configured. Add missing list IDs to enable each cohort."
                : "Add SENDFOX_ACCESS_TOKEN and cohort list IDs in your env to enable live sync."}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <div className="space-y-3">
          {data.cohorts.map((cohort) => {
            const Icon = iconByCohort[cohort.id] || MailCheck;
            const isSelected = selectedCohort?.id === cohort.id;
            return (
              <button
                type="button"
                key={cohort.id}
                onClick={() => setSelectedId(cohort.id)}
                className={`w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 ${
                  isSelected ? "border-primary ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{cohort.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {cohort.action}
                      </div>
                    </div>
                  </div>
                  <Badge variant={cohort.sendfoxReady ? "default" : "outline"}>
                    {cohort.count}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {selectedCohort && (
          <Card className="rounded-lg">
            <CardHeader className="border-b">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>{selectedCohort.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {selectedCohort.description}
                  </CardDescription>
                  {selectedCohort.truth && (
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div>{selectedCohort.truth.definition}</div>
                      <div>
                        Sources: {selectedCohort.truth.sourceTables.join(", ")}
                      </div>
                      <div>
                        Matched {selectedCohort.truth.matchedUsers.toLocaleString()} users;
                        showing top {Math.min(12, selectedCohort.users.length).toLocaleString()} rows.
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedCohort.priority}</Badge>
                  <Badge variant={selectedCohort.sendfoxReady ? "default" : "outline"}>
                    {selectedCohort.sendfoxReady ? "SendFox ready" : "Needs list ID"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium">{selectedCohort.action}</div>
                  <div className="text-xs text-muted-foreground">
                    List ID: {selectedCohort.sendfoxListId || "not configured"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!selectedCohort.sendfoxListId || selectedCohort.count === 0}
                    onClick={() => syncCohort(selectedCohort.id, true)}
                  >
                    Preview Sync
                  </Button>
                  <Button
                    disabled={!selectedCohort.sendfoxReady || selectedCohort.count === 0}
                    onClick={() => syncCohort(selectedCohort.id, false)}
                  >
                    <Send className="size-4" />
                    Sync to SendFox
                  </Button>
                </div>
              </div>

              {selectedCohort.campaign && (
                <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">
                      {selectedCohort.campaign.segment} campaign
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Goal: {selectedCohort.campaign.goal}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Tone: {selectedCohort.campaign.tone}
                    </div>
                    <div className="rounded-md bg-background px-3 py-2 text-sm">
                      <span className="font-medium">Subject:</span>{" "}
                      {selectedCohort.campaign.subject}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCohort.campaign.emailPreview}
                    </div>
                  </div>
                  <div className="rounded-md bg-background px-3 py-2 text-sm">
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                      Short message
                    </div>
                    {selectedCohort.campaign.shortMessage}
                  </div>
                </div>
              )}

              {syncState[selectedCohort.id]?.message && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {syncState[selectedCohort.id].message}
                </div>
              )}

              <SupermemoryPanel cohort={selectedCohort} />

              <UserRows users={selectedCohort.users || []} />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
