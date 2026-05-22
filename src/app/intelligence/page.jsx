"use client";

import { TrendingUp, Activity, AlertTriangle, Users, UserMinus } from "lucide-react";
import { MetricCard, COLORS } from "@/components/ui/metric-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserIntelligenceData } from "@/hooks/use-user-intelligence-data";
import { formatDistanceToNow, format } from "date-fns";

function getHealthScoreBadgeClass(score) {
  const s = Number(score);
  if (s >= 61) return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
  if (s >= 31) return "bg-yellow-500/15 text-yellow-700 border-yellow-200";
  return "bg-red-500/15 text-red-700 border-red-200";
}

function getStatusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pro") return "bg-emerald-500/15 text-emerald-700 border-emerald-200";
  if (s.includes("trial")) return "bg-yellow-500/15 text-yellow-700 border-yellow-200";
  return "bg-slate-500/15 text-slate-700 border-slate-200";
}

function formatRelative(dateVal) {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  try {
    return format(new Date(dateVal), "MMM dd, yyyy");
  } catch {
    return "—";
  }
}

function DaysSilentCell({ days }) {
  const d = Number(days ?? 0);
  if (d > 14) return <span className="text-red-600 font-medium">{d}d</span>;
  if (d >= 7) return <span className="text-orange-500 font-medium">{d}d</span>;
  return <span>{d}d</span>;
}

export default function IntelligencePage() {
  const { data, isLoading, error } = useUserIntelligenceData();

  const { upgradeCandidates, churnRisk, healthDistribution } = data;

  const champions = healthDistribution.find((s) => s.segment === "Champion")?.user_count ?? 0;
  const engaged = healthDistribution.find((s) => s.segment === "Engaged")?.user_count ?? 0;
  const atRisk = healthDistribution.find((s) => s.segment === "At Risk")?.user_count ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Intelligence</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          User Intelligence
        </h1>
        <p className="mt-2 text-muted-foreground text-sm md:text-base">
          Who to reach out to, and who is at risk of leaving
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-500">Error: {error}</p>
        )}
      </div>

      {/* Section 1: Health Score Summary */}
      <section>
        <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
          Health Score Summary
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <MetricCard
            title="Champions"
            value={Number(champions).toLocaleString()}
            subtitle="Health score 61–100"
            icon={TrendingUp}
            color={COLORS.success}
          />
          <MetricCard
            title="Engaged"
            value={Number(engaged).toLocaleString()}
            subtitle="Health score 31–60"
            icon={Activity}
            color={COLORS.warning}
          />
          <MetricCard
            title="At Risk"
            value={Number(atRisk).toLocaleString()}
            subtitle="Health score 0–30"
            icon={AlertTriangle}
            color={COLORS.danger}
          />
        </div>
      </section>

      {/* Section 2: Upgrade Candidates */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg md:text-xl font-bold">Upgrade Candidates</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Top free users to personally reach out to this week
          </p>
        </div>

        {upgradeCandidates.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Prompts</TableHead>
                    <TableHead className="text-right">Days Active</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Modes Used</TableHead>
                    <TableHead className="text-right">Health Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upgradeCandidates.map((user, idx) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{user.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(user.total_prompts).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(user.active_days)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatRelative(user.last_active)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(user.modes_used)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={getHealthScoreBadgeClass(user.health_score)}
                        >
                          {Number(user.health_score)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </section>

      {/* Section 3: Churn Risk */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg md:text-xl font-bold">Churn Risk</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Previously active users who've gone quiet — reach out before they leave
          </p>
        </div>

        {churnRisk.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Prompts</TableHead>
                    <TableHead className="text-right">Days Silent</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churnRisk.map((user, idx) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{user.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusBadgeClass(user.status)}
                        >
                          {user.status || "free"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(user.total_prompts).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <DaysSilentCell days={user.days_since_active} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.last_active)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.most_used_platform || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.most_used_mode || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </section>
    </div>
  );
}
