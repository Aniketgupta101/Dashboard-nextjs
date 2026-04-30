"use client";

import { useMemo, useState } from "react";
import { Activity, MousePointerClick, Users } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ChartCard, COLORS } from "@/components/ui/metric-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnterprisePosthogData } from "@/hooks/use-enterprise-posthog-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export default function EnterpriseAnalyticsPage() {
  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState();
  const [enterpriseId, setEnterpriseId] = useState("all");
  const { data, isLoading, error } = useEnterprisePosthogData(
    dateFilter,
    customDateRange,
    enterpriseId,
  );

  const avgDailyEvents = useMemo(() => {
    if (!data.eventsOverTime?.length) return 0;
    const total = data.eventsOverTime.reduce((acc, d) => acc + d.count, 0);
    return total / data.eventsOverTime.length;
  }, [data.eventsOverTime]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Enterprise Analytics
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            PostHog event analytics for enterprise usage behavior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterBar
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            sourceFilter="All"
            onSourceFilterChange={() => {}}
            customDateRange={customDateRange}
            onCustomDateChange={setCustomDateRange}
            hideSourceFilter
          />
          <select
            value={enterpriseId}
            onChange={(e) => setEnterpriseId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="all">All enterprises</option>
            {(data.enterpriseOptions || []).map((option) => (
              <option key={option.enterpriseId} value={option.enterpriseId}>
                {option.enterpriseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Metrics
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Total Events"
                value={data.totalEvents || 0}
                subtitle="Tracked events in selected range"
                icon={Activity}
              />
              <StatCard
                title="Active Users"
                value={data.activeUsers || 0}
                subtitle="Unique users (distinct_id)"
                icon={Users}
              />
              <StatCard
                title="Avg Events / Day"
                value={avgDailyEvents.toFixed(1)}
                subtitle="Average daily event volume"
                icon={MousePointerClick}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Trends
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <ChartCard title="Events Over Time">
                <ChartContainer
                  config={{ count: { label: "Events", color: COLORS.primary } }}
                  className="h-[260px] w-full"
                >
                  <AreaChart data={data.eventsOverTime || []}>
                    <defs>
                      <linearGradient id="fillEnterpriseEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.primary}
                      fill="url(#fillEnterpriseEvents)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Top Events">
                <ChartContainer
                  config={{ count: { label: "Count", color: COLORS.warning } }}
                  className="h-[260px] w-full"
                >
                  <BarChart data={data.topEvents || []} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="event"
                      width={140}
                      tick={{ fontSize: 10 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.warning} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Events Table
            </h2>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-left font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topEvents || []).map((row) => (
                      <tr key={row.event} className="border-t border-border/40">
                        <td className="px-4 py-3">{row.event}</td>
                        <td className="px-4 py-3">{row.count}</td>
                      </tr>
                    ))}
                    {(data.topEvents || []).length === 0 ? (
                      <tr className="border-t border-border/40">
                        <td className="px-4 py-4 text-muted-foreground" colSpan={2}>
                          No PostHog events found for selected range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Enterprise analytics warning: {error}
        </div>
      ) : null}
    </div>
  );
}
