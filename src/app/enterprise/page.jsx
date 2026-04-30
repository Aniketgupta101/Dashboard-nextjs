"use client";

import { useMemo, useState } from "react";
import { Building2, Users, UsersRound, MessageSquareText } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ChartCard, COLORS } from "@/components/ui/metric-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnterpriseData } from "@/hooks/use-enterprise-data";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
];

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

export default function EnterprisePage() {
  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState();
  const [enterpriseId, setEnterpriseId] = useState("all");
  const { data, isLoading, error } = useEnterpriseData(
    dateFilter,
    customDateRange,
    enterpriseId,
  );

  const summary = data?.summary || {};
  const topTeams = data?.topTeams || [];
  const teamChartData = useMemo(
    () =>
      topTeams.slice(0, 8).map((t) => ({
        name: `${t.teamName} (${(t.enterpriseName || "").slice(0, 10)})`,
        prompts: t.enhancedPrompts,
        fullName: `${t.teamName} (${t.enterpriseName})`,
      })),
    [topTeams],
  );

  const enterpriseChartData = (data?.topEnterprises || []).map((e) => ({
    name: e.enterpriseName,
    prompts: e.prompts,
    users: e.users,
  }));

  const intentData = (data?.intents || []).map((i) => ({
    name: i.intent,
    value: i.count,
  }));

  const moderationData = (data?.moderationActions || []).map((m) => ({
    name: m.action,
    count: m.count,
  }));

  const queueData = (data?.queueStatus || []).map((q) => ({
    name: q.status,
    value: q.count,
  }));

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Enterprise
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Enterprise adoption, team behavior, and prompt usage analytics.
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
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Enterprise Overview
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Active Enterprises"
                value={summary.activeEnterprises || 0}
                subtitle={`${(summary.enterpriseActivationRate || 0).toFixed(1)}% running prompts in selected period`}
                icon={Building2}
              />
              <StatCard
                title="Onboarding Completion"
                value={`${(summary.onboardingRate || 0).toFixed(1)}%`}
                subtitle={`${summary.onboardedEnterprises || 0} completed, ${summary.failedOnboarding || 0} failed`}
                icon={UsersRound}
              />
              <StatCard
                title="Active Users"
                value={summary.activeUsers || 0}
                subtitle={`${summary.activePromptUsers || 0} users generated prompts`}
                icon={Users}
              />
              <StatCard
                title="Prompt Throughput"
                value={summary.promptsInRange || 0}
                subtitle={`${(summary.promptsPerActiveUser || 0).toFixed(2)} prompts per active user`}
                icon={MessageSquareText}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Enterprise Insights
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <ChartCard title="Prompt Trend" tooltip="Daily enterprise prompt activity">
                <ChartContainer
                  config={{
                    prompts: { label: "Prompts", color: COLORS.primary },
                    users: { label: "Users", color: COLORS.success },
                  }}
                  className="h-[240px] w-full"
                >
                  <AreaChart data={data.dailyPrompts || []}>
                    <defs>
                      <linearGradient id="fillEnterprisePrompts" x1="0" y1="0" x2="0" y2="1">
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
                      dataKey="prompts"
                      stroke={COLORS.primary}
                      fill="url(#fillEnterprisePrompts)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Top Enterprises by Prompt Volume">
                <ChartContainer
                  config={{
                    prompts: { label: "Prompts", color: COLORS.warning },
                  }}
                  className="h-[240px] w-full"
                >
                  <BarChart data={enterpriseChartData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 10 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="prompts" fill={COLORS.warning} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Top Teams by Enhanced Prompts">
                <ChartContainer
                  config={{
                    prompts: { label: "Enhanced Prompts", color: COLORS.info },
                  }}
                  className="h-[260px] w-full"
                >
                  <BarChart data={teamChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, item) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">
                                {item?.payload?.fullName}
                              </span>
                              <span className="font-medium">
                                {name}: {value}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="prompts" fill={COLORS.info} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Intent Mix" tooltip="What enterprise users ask the assistant most">
                <ChartContainer
                  config={Object.fromEntries(
                    intentData.map((i, idx) => [
                      i.name,
                      { label: i.name, color: PIE_COLORS[idx % PIE_COLORS.length] },
                    ]),
                  )}
                  className="h-[260px] w-full flex justify-center"
                >
                  <PieChart>
                    <Pie
                      data={intentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={84}
                      innerRadius={42}
                      paddingAngle={2}
                    >
                      {intentData.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Governance & Risk
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <ChartCard title="Moderation Decision Actions">
                <ChartContainer
                  config={Object.fromEntries(
                    moderationData.map((m, idx) => [
                      m.name,
                      { label: m.name, color: PIE_COLORS[idx % PIE_COLORS.length] },
                    ]),
                  )}
                  className="h-[240px] w-full"
                >
                  <BarChart data={moderationData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Guardrail Queue Status">
                <ChartContainer
                  config={Object.fromEntries(
                    queueData.map((q, idx) => [
                      q.name,
                      { label: q.name, color: PIE_COLORS[idx % PIE_COLORS.length] },
                    ]),
                  )}
                  className="h-[240px] w-full flex justify-center"
                >
                  <PieChart>
                    <Pie
                      data={queueData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={86}
                      innerRadius={46}
                    >
                      {queueData.map((q, idx) => (
                        <Cell key={q.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-bold mb-4 pb-2 border-b-2">
              Enterprise Table
            </h2>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Enterprise</th>
                      <th className="px-4 py-3 text-left font-medium">Slug</th>
                      <th className="px-4 py-3 text-left font-medium">Users</th>
                      <th className="px-4 py-3 text-left font-medium">Prompts</th>
                      <th className="px-4 py-3 text-left font-medium">Top Team</th>
                      <th className="px-4 py-3 text-left font-medium">Team Prompts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topEnterprises || []).map((enterprise) => {
                      const topTeam =
                        (data.topTeams || []).find(
                          (t) => t.enterpriseName === enterprise.enterpriseName,
                        ) || null;
                      return (
                        <tr
                          key={enterprise.enterpriseId}
                          className="border-t border-border/40"
                        >
                          <td className="px-4 py-3">{enterprise.enterpriseName}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {enterprise.enterpriseSlug || "-"}
                          </td>
                          <td className="px-4 py-3">{enterprise.users}</td>
                          <td className="px-4 py-3">{enterprise.prompts}</td>
                          <td className="px-4 py-3">
                            {topTeam ? topTeam.teamName : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {topTeam ? topTeam.enhancedPrompts : 0}
                          </td>
                        </tr>
                      );
                    })}
                    {(data.topEnterprises || []).length === 0 ? (
                      <tr className="border-t border-border/40">
                        <td
                          className="px-4 py-4 text-muted-foreground"
                          colSpan={6}
                        >
                          No enterprise records available for the selected range.
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
          Enterprise data warning: {error}
        </div>
      ) : null}
    </div>
  );
}
