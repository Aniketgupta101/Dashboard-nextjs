"use client";

import { useCohortData } from "@/hooks/use-cohort-data";
import { MetricCard, ChartCard, COLORS } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, TrendingUp, BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

function getCellStyle(pct) {
  if (pct === null) return null;
  if (pct >= 30)
    return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold";
  if (pct >= 15) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
  if (pct >= 5)
    return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  return "bg-red-500/10 text-red-600 dark:text-red-400";
}

const W1TrendTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background/95 p-3 shadow-xl backdrop-blur-md border-border/50 min-w-[150px]">
        <div className="text-xs font-semibold text-foreground mb-1">{label}</div>
        <div className="text-xs text-muted-foreground">
          W1 Retention:{" "}
          <span className="font-mono font-semibold text-foreground">
            {payload[0].value}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function CohortsPage() {
  const { data, isLoading, error } = useCohortData();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Cohort Retention
          </h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Cohort Retention
        </h1>
        <p className="text-red-500">Error loading cohort data: {error}</p>
      </div>
    );
  }

  // Summary metrics
  const validW1 = data.filter((r) => r.w1 !== null).map((r) => r.w1);
  const avgW1 =
    validW1.length > 0
      ? Math.round(validW1.reduce((a, b) => a + b, 0) / validW1.length)
      : null;

  const validW2 = data.filter((r) => r.w2 !== null).map((r) => r.w2);
  const avgW2 =
    validW2.length > 0
      ? Math.round(validW2.reduce((a, b) => a + b, 0) / validW2.length)
      : null;

  const latestCohortSize = data.length > 0 ? data[0].cohort_size : 0;

  // W1 trend — last 10 cohorts, oldest to newest
  const trendData = [...data]
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      label: (() => {
        try {
          return format(parseISO(r.cohort_week), "MMM dd");
        } catch {
          return r.cohort_week;
        }
      })(),
      w1: r.w1 ?? 0,
    }));

  const columns = [
    { key: "w0", label: "W0", countKey: "w0_count" },
    { key: "w1", label: "W1", countKey: "w1_count" },
    { key: "w2", label: "W2", countKey: "w2_count" },
    { key: "w4", label: "W4", countKey: "w4_count" },
    { key: "w8", label: "W8", countKey: "w8_count" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Cohort Retention
        </h1>
        <p className="mt-1 text-muted-foreground text-sm md:text-base">
          Weekly cohort analysis — last 16 weeks
        </p>
      </div>

      {/* Summary MetricCards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <MetricCard
          title="Avg W1 Retention"
          value={avgW1 !== null ? `${avgW1}%` : "—"}
          subtitle="Across all cohorts"
          icon={TrendingUp}
          color={COLORS.primary}
          tooltip="Average Week-1 retention percentage across all cohorts in the last 16 weeks."
        />
        <MetricCard
          title="Avg W2 Retention"
          value={avgW2 !== null ? `${avgW2}%` : "—"}
          subtitle="Across all cohorts"
          icon={BarChart2}
          color={COLORS.secondary}
          tooltip="Average Week-2 retention percentage across all cohorts in the last 16 weeks."
        />
        <MetricCard
          title="Latest Cohort Size"
          value={latestCohortSize.toLocaleString()}
          subtitle="Most recent week"
          icon={Users}
          color={COLORS.success}
          tooltip="Number of users who signed up in the most recent cohort week."
        />
      </div>

      {/* Cohort Grid Table */}
      <ChartCard
        title="Cohort Retention Grid"
        tooltip="Weekly cohort retention table. Each row is a signup cohort. Percentages show how many of the cohort's users were active in that week relative to their signup week."
      >
        <ScrollArea className="max-h-[600px] w-full">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground whitespace-nowrap">
                  Cohort Week
                </th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                  Users
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="text-center py-3 px-4 font-semibold text-muted-foreground"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={row.cohort_week}
                  className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-muted/20" : ""}`}
                >
                  <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                    {row.cohort_week}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold">
                    {row.cohort_size.toLocaleString()}
                  </td>
                  {columns.map((col) => {
                    const pct = row[col.key];
                    const count = row[col.countKey];
                    const cellClass = getCellStyle(pct);
                    return (
                      <td key={col.key} className="py-2 px-2 text-center">
                        {pct === null ? (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        ) : (
                          <div
                            className={`inline-flex flex-col items-center rounded-md px-2 py-1 min-w-[60px] ${cellClass}`}
                          >
                            <span className="text-xs font-semibold leading-tight">
                              {pct}%
                            </span>
                            <span className="text-[10px] opacity-70 leading-tight">
                              ({count})
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No cohort data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </ChartCard>

      {/* W1 Trend Bar Chart */}
      <ChartCard
        title="Week-1 Retention Trend"
        tooltip="W1 retention percentage for the last 10 cohorts, displayed oldest to newest."
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trendData}
              margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-muted-foreground/10"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                unit="%"
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                width={40}
              />
              <Tooltip content={<W1TrendTooltip />} />
              <Bar
                dataKey="w1"
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
