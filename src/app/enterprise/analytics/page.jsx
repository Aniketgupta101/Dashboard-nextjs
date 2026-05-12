"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Info,
  LayoutDashboard,
  MousePointerClick,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ChartCard, COLORS } from "@/components/ui/metric-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEnterprisePosthogData } from "@/hooks/use-enterprise-posthog-data";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const DASH_TABS = [
  { id: "overview", label: "Org health", icon: LayoutDashboard },
  { id: "acquisition", label: "Acquisition & auth", icon: MousePointerClick },
  { id: "prompts", label: "Prompt intelligence", icon: Sparkles },
  { id: "governance", label: "Governance & risk", icon: Shield },
  { id: "engagement", label: "Engagement & admin", icon: Users },
];

/** Shown only for the active tab â€” maps to Velocity Enterprise spec sections. */
const TAB_CONTEXT = {
  overview: {
    title: "Org health",
    spec: "Spec Â§2.3 / Â§4 â€” Org Health dashboard",
    bullets: [
      "Primary signals: prompts per day, DAU trend, and a stickiness-style engagement index.",
      "Charts use HogQL on your enterprise PostHog project (date range + optional enterprise filter).",
      "Enterprise scope matches properties: enterpriseId, enterprise_id, enterprise, org_id, workspace_id.",
    ],
  },
  acquisition: {
    title: "Acquisition & auth",
    spec: "Spec Â§2.1 â€” Acquisition & auth metrics",
    bullets: [
      "Auth funnel: counts per named event (page_viewed_landing, login_success, etc.).",
      "Login failures: breakdown of login_failed by error_type (e.g. wrong_password, no_team).",
      "SSO vs manual: login_success grouped by method property (sso | manual).",
      "CTR and time-to-first-login are best modeled as PostHog funnels; this view validates raw volumes.",
    ],
  },
  prompts: {
    title: "Prompt intelligence",
    spec: "Spec Â§2.4 â€” Prompt quality & AI usage",
    bullets: [
      "Model and speed charts read properties on prompt_submitted: model_used, speed_mode.",
      "Refinement rate uses prompt_refinement_submitted Ã· prompt_submitted.",
      "Starter funnel counts starter_prompt_viewed, shuffle, selected; attachment rate uses file_attached vs prompts.",
    ],
  },
  governance: {
    title: "Governance & risk",
    spec: "Spec Â§2.5 â€” Governance & compliance",
    bullets: [
      "Governance events include policy flags, VYGR-specific flags, and related system events.",
      "Flag rate is a proxy: flagged-style event count Ã· prompt_submitted in the same period.",
      "Policy toggles count data_protection_rule_toggled and tool_access_toggled; audit uses audit_log_viewed.",
    ],
  },
  engagement: {
    title: "Engagement & admin",
    spec: "Spec Â§2.3 / Â§2.6 â€” Engagement & admin surfaces",
    bullets: [
      "Personalization: saves vs views from personalization_profile_saved and personalization_viewed.",
      "Notifications: read rate from notification_read vs notifications_viewed.",
      "Exports: csv_exported by export_type; roles from login_success (role or user_role).",
    ],
  },
};

function TabContextPanel({ tabId }) {
  const ctx = TAB_CONTEXT[tabId];
  if (!ctx) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">{ctx.title}</p>
        <span className="text-[11px] text-muted-foreground font-mono">{ctx.spec}</span>
      </div>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-xs md:text-sm text-muted-foreground">
        {ctx.bullets.map((line, i) => (
          <li key={`${tabId}-${i}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}


function StatCard({ title, value, subtitle, icon: Icon, tooltip }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{title}</p>
            {tooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 rounded-full text-muted-foreground/60 outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label={`About ${title}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[280px] text-[11px] leading-relaxed"
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

function MiniTable({ columns, rows, empty }) {
  if (!rows?.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">{empty}</p>
    );
  }
  return (
    <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/40">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KPI_COPY = {
  activeUsers: (
    <>
      <span className="font-medium text-foreground">What it is:</span> unique
      people (PostHog{" "}
      <code className="rounded bg-muted px-0.5">distinct_id</code>) who fired any
      event in the selected range, after filters.
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span>{" "}
      <code className="text-[10px]">count(DISTINCT distinct_id)</code> over
      events, scoped by date and enterprise/org properties.
    </>
  ),
  totalEvents: (
    <>
      <span className="font-medium text-foreground">What it is:</span> total
      ingested events in range matching filters.
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span>{" "}
      <code className="text-[10px]">count()</code> on the events table. Internal
      noise events like{" "}
      <code className="rounded bg-muted px-0.5">$snapshot</code> are excluded in
      the API.
    </>
  ),
  prompts: (
    <>
      <span className="font-medium text-foreground">What it is:</span> number of
      times users submitted a prompt.
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span>{" "}
      count of events where{" "}
      <code className="rounded bg-muted px-0.5">event = prompt_submitted</code>.
    </>
  ),
  refinement: (
    <>
      <span className="font-medium text-foreground">What it is:</span> share of
      prompts that were refined after the first run.
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span>{" "}
      100 Ã—{" "}
      <code className="text-[10px]">
        count(prompt_refinement_submitted) / count(prompt_submitted)
      </code>
      . Same date and filters apply to both counts.
    </>
  ),
  flagRate: (
    <>
      <span className="font-medium text-foreground">What it is:</span> governance
      flag volume relative to prompt traffic (proxy for â€œflagged rateâ€).
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span>{" "}
      100 Ã— (count of selected governance / flag-style events) Ã·{" "}
      <code className="rounded bg-muted px-0.5">prompt_submitted</code>. See API
      for the exact event list.
    </>
  ),
  avgDau: (
    <>
      <span className="font-medium text-foreground">What it is:</span> average
      daily active users across days that have data in the range.
      <br />
      <span className="font-medium text-foreground">How itâ€™s calculated:</span> for
      each day: distinct users that day; then the arithmetic mean of those daily
      counts (not the same as period uniques Ã· days).
    </>
  ),
};

export default function EnterpriseAnalyticsPage() {
  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState();
  const [enterpriseId, setEnterpriseId] = useState("all");
  const [tab, setTab] = useState("overview");
  const { data, isLoading, error } = useEnterprisePosthogData(
    dateFilter,
    customDateRange,
    enterpriseId,
  );

  const combinedPromptDau = useMemo(() => {
    const map = new Map();
    (data.orgHealth?.promptsPerDay || []).forEach((r) => {
      map.set(r.date, { date: r.date, prompts: r.prompts, dau: 0 });
    });
    (data.orgHealth?.dauTrend || []).forEach((r) => {
      const cur = map.get(r.date) || { date: r.date, prompts: 0, dau: 0 };
      cur.dau = r.dau;
      map.set(r.date, cur);
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data.orgHealth?.promptsPerDay, data.orgHealth?.dauTrend]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Enterprise analytics
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-3xl">
            PostHog-backed observability for Velocity Enterprise. Pick a tab below
            for scope and metric definitions; hover the{" "}
            <Info className="inline h-3.5 w-3.5 align-text-bottom opacity-70" />{" "}
            icons on KPIs and charts for formulas.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
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
            className="h-9 rounded-md border border-border bg-background px-3 text-sm min-w-[180px]"
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

      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-2">
        {DASH_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <TabContextPanel tabId={tab} />

      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            title="Period active users"
            value={data.activeUsers ?? 0}
            subtitle="Distinct PostHog users"
            icon={Users}
            tooltip={KPI_COPY.activeUsers}
          />
          <StatCard
            title="Total events"
            value={data.totalEvents ?? 0}
            subtitle="All tracked events"
            icon={Activity}
            tooltip={KPI_COPY.totalEvents}
          />
          <StatCard
            title="Prompts submitted"
            value={data.promptIntelligence?.promptSubmissions ?? 0}
            subtitle="prompt_submitted"
            icon={MousePointerClick}
            tooltip={KPI_COPY.prompts}
          />
          <StatCard
            title="Refinement rate"
            value={`${data.promptIntelligence?.refinementRate ?? 0}%`}
            subtitle="refinements Ã· prompts"
            icon={Sparkles}
            tooltip={KPI_COPY.refinement}
          />
          <StatCard
            title="Governance flag rate"
            value={`${data.governance?.flaggedRate ?? 0}%`}
            subtitle="flags Ã· prompts (proxy)"
            icon={Shield}
            tooltip={KPI_COPY.flagRate}
          />
          <StatCard
            title="Avg DAU"
            value={data.orgHealth?.avgDau ?? 0}
            subtitle="Mean daily active users"
            icon={LayoutDashboard}
            tooltip={KPI_COPY.avgDau}
          />
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      ) : (
        <>
          {tab === "overview" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard source="posthog"
                title="Prompts per day vs DAU"
                tooltip={
                  <>
                    <span className="font-medium text-foreground">Prompts:</span>{" "}
                    daily count of{" "}
                    <code className="rounded bg-muted px-0.5">prompt_submitted</code>
                    .
                    <br />
                    <span className="font-medium text-foreground">DAU:</span> per
                    calendar day, distinct{" "}
                    <code className="rounded bg-muted px-0.5">distinct_id</code>{" "}
                    with any event. Lines are merged by date for comparison.
                  </>
                }
              >
                <ChartContainer
                  config={{
                    prompts: { label: "Prompts", color: COLORS.primary },
                    dau: { label: "DAU", color: COLORS.info },
                  }}
                  className="h-[300px] w-full"
                >
                  <LineChart data={combinedPromptDau}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="prompts"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="dau"
                      stroke={COLORS.info}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard source="posthog"
                title="Event volume (all sources)"
                tooltip={
                  <>
                    Total event volume per day (same scope as filters). Useful to
                    correlate traffic spikes with prompts or auth issues.
                  </>
                }
              >
                <ChartContainer
                  config={{ count: { label: "Events", color: COLORS.primary } }}
                  className="h-[300px] w-full"
                >
                  <AreaChart data={data.eventsOverTime || []}>
                    <defs>
                      <linearGradient id="fillEv" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={COLORS.primary}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.primary}
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.primary}
                      fill="url(#fillEv)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard source="posthog"
                title="Engagement index"
                tooltip={
                  <>
                    <span className="font-medium text-foreground">Formula:</span>{" "}
                    average daily DAU Ã· period unique users (
                    <code className="text-[10px]">avg_dau / active_users</code>
                    ). Higher suggests users show up on more days relative to the
                    cohort size (stickiness-style; not calendar DAU/MAU).
                  </>
                }
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Live value:{" "}
                  <span className="font-mono text-foreground">
                    {(data.orgHealth?.engagementIndex ?? 0).toFixed(3)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Reference library size:{" "}
                  {data.orgHealth?.trackedEventInventory ?? "â€”"} named events.
                </p>
              </ChartCard>

              <ChartCard source="posthog"
                title="Top events"
                tooltip={
                  <>
                    Ranked raw event names by volume â€” quick check that
                    instrumentation keys match expectations (e.g.{" "}
                    <code className="rounded bg-muted px-0.5">login_success</code>
                    ).
                  </>
                }
              >
                <ChartContainer
                  config={{ count: { label: "Count", color: COLORS.warning } }}
                  className="h-[300px] w-full"
                >
                  <BarChart
                    data={(data.topEvents || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="event"
                      width={160}
                      tick={{ fontSize: 9 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill={COLORS.warning}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          ) : null}

          {tab === "acquisition" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard source="posthog"
                title="Auth funnel (named events)"
                tooltip={
                  <>
                    Counts per event name in the auth group (landing, CTA, login,
                    logout, etc.). Expands as you add instrumentation.
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "event", label: "Event" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={(data.acquisition?.authEvents || []).map((r) => ({
                    event: r.event,
                    count: r.count,
                  }))}
                  empty="No auth events in range â€” instrument page_viewed_landing, login_success, etc."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Login failures by error_type"
                tooltip={
                  <>
                    Only <code className="rounded bg-muted px-0.5">login_failed</code>{" "}
                    events. Property{" "}
                    <code className="rounded bg-muted px-0.5">error_type</code>{" "}
                    grouped; empty coalesces to &quot;unknown&quot;.
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "errorType", label: "Error" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.acquisition?.loginFailureByType || []}
                  empty="No login_failed events â€” track error_type (e.g. no_team)."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Login method (SSO vs manual)"
                tooltip={
                  <>
                    From <code className="rounded bg-muted px-0.5">login_success</code>
                    . Expect{" "}
                    <code className="rounded bg-muted px-0.5">method</code> in
                    properties (e.g. sso | manual). Bars are login counts, not
                    users.
                  </>
                }
              >
                <ChartContainer
                  config={{ c: { label: "Logins", color: COLORS.success } }}
                  className="h-[260px] w-full"
                >
                  <BarChart data={data.acquisition?.loginMethod || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="method" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.success} radius={4} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
              <ChartCard source="posthog"
                title="CTR & funnel next steps"
                tooltip={
                  <>
                    Register vs login CTR and time-to-first-login need PostHog
                    funnel or sequence analysis. This dashboard only surfaces raw
                    counts for validation before building those funnels.
                  </>
                }
              >
                <p className="text-sm text-muted-foreground">
                  Use PostHog Funnels for{" "}
                  <code className="text-xs">page_viewed_landing</code> â†’{" "}
                  <code className="text-xs">cta_clicked_login</code> â†’{" "}
                  <code className="text-xs">login_success</code> â†’{" "}
                  <code className="text-xs">prompt_submitted</code>. Raw auth
                  counts above confirm instrumentation volume.
                </p>
              </ChartCard>
            </div>
          ) : null}

          {tab === "prompts" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard source="posthog"
                title="Model usage"
                tooltip={
                  <>
                    Parsed from{" "}
                    <code className="rounded bg-muted px-0.5">
                      prompt_submitted
                    </code>{" "}
                    â†’ property{" "}
                    <code className="rounded bg-muted px-0.5">model_used</code>{" "}
                    (empty â†’ &quot;unknown&quot;).
                  </>
                }
              >
                <ChartContainer
                  config={{ count: { label: "Prompts", color: COLORS.primary } }}
                  className="h-[280px] w-full"
                >
                  <BarChart data={data.promptIntelligence?.modelDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="model" tick={{ fontSize: 9 }} angle={-25} height={70} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.primary} radius={4} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
              <ChartCard source="posthog"
                title="Speed mode"
                tooltip={
                  <>
                    From{" "}
                    <code className="rounded bg-muted px-0.5">
                      prompt_submitted.speed_mode
                    </code>{" "}
                    (e.g. fast | balanced | deep).
                  </>
                }
              >
                <ChartContainer
                  config={{ count: { label: "Prompts", color: COLORS.info } }}
                  className="h-[280px] w-full"
                >
                  <BarChart
                    data={data.promptIntelligence?.speedModeDistribution || []}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="speedMode" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.info} radius={4} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
              <ChartCard source="posthog"
                title="Starter prompt funnel"
                tooltip={
                  <>
                    Event counts: viewed â†’ shuffle â†’ selected. Use ratios between
                    steps as funnel conversion proxies.
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "event", label: "Event" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.promptIntelligence?.starterEvents || []}
                  empty="No starter_prompt_* events yet."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Attachment usage"
                tooltip={
                  <>
                    <span className="font-medium text-foreground">Rate:</span> 100
                    Ã—{" "}
                    <code className="text-[10px]">
                      count(file_attached) / count(prompt_submitted)
                    </code>
                    . Attachment events may occur without a matching prompt in edge
                    cases; treat as approximate.
                  </>
                }
              >
                <div className="space-y-2 text-sm">
                  <p>
                    <strong className="text-foreground">file_attached</strong>{" "}
                    events: {data.promptIntelligence?.attachmentEvents ?? 0}
                  </p>
                  <p>
                    Attachment rate vs prompts:{" "}
                    <span className="font-semibold">
                      {data.promptIntelligence?.attachmentRate ?? 0}%
                    </span>
                  </p>
                </div>
              </ChartCard>
            </div>
          ) : null}

          {tab === "governance" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard source="posthog"
                title="Governance & compliance events"
                tooltip={
                  <>
                    Counts for policy / flag events defined in the enterprise
                    analytics module (e.g.{" "}
                    <code className="rounded bg-muted px-0.5">
                      prompt_flagged_by_system
                    </code>
                    , VYGR-specific events).
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "event", label: "Event" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.governance?.governanceEvents || []}
                  empty="No governance events â€” instrument prompt_flagged_by_system, review flows, VYGR-specific flags."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Policy center toggles"
                tooltip={
                  <>
                    Count of{" "}
                    <code className="rounded bg-muted px-0.5">
                      data_protection_rule_toggled
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-muted px-0.5">
                      tool_access_toggled
                    </code>{" "}
                    events (admin configuration churn).
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "event", label: "Event" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.governance?.policyToggles || []}
                  empty="No policy toggles recorded."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Audit & risk summary"
                tooltip={
                  <>
                    Flag rate uses governance subset Ã· prompts. Audit figure is
                    count of{" "}
                    <code className="rounded bg-muted px-0.5">
                      audit_log_viewed
                    </code>
                    .
                  </>
                }
              >
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>
                    Flag-style events (subset):{" "}
                    <strong className="text-foreground">
                      {data.governance?.flaggedOrViolationEvents ?? 0}
                    </strong>
                  </li>
                  <li>
                    Flag rate vs prompts:{" "}
                    <strong className="text-foreground">
                      {data.governance?.flaggedRate ?? 0}%
                    </strong>
                  </li>
                  <li>
                    <code className="text-xs">audit_log_viewed</code>:{" "}
                    <strong className="text-foreground">
                      {data.governance?.auditLogViews ?? 0}
                    </strong>
                  </li>
                </ul>
              </ChartCard>
              <ChartCard source="posthog"
                title="Review queue & resolution"
                tooltip={
                  <>
                    SLA metrics need timestamps on queue enter/exit events. Counts
                    in other panels validate that review actions are firing.
                  </>
                }
              >
                <p className="text-sm text-muted-foreground">
                  Wire{" "}
                  <code className="text-xs">review_queue_item_actioned</code> with
                  timestamps for median time-in-queue; backlog counts need queue
                  state snapshots or periodic scans.
                </p>
              </ChartCard>
            </div>
          ) : null}

          {tab === "engagement" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard source="posthog"
                title="Personalization"
                tooltip={
                  <>
                    <span className="font-medium text-foreground">
                      Completion rate:
                    </span>{" "}
                    100 Ã— saves Ã· views (
                    <code className="text-[10px]">
                      personalization_profile_saved / personalization_viewed
                    </code>
                    ).
                  </>
                }
              >
                <ul className="text-sm space-y-2">
                  <li>
                    Profile saves:{" "}
                    <strong>{data.engagement?.personalizationSaves ?? 0}</strong>
                  </li>
                  <li>
                    Views:{" "}
                    <strong>{data.engagement?.personalizationViews ?? 0}</strong>
                  </li>
                  <li>
                    Completion rate:{" "}
                    <strong>
                      {data.engagement?.personalizationCompletionRate ?? 0}%
                    </strong>
                  </li>
                </ul>
              </ChartCard>
              <ChartCard source="posthog"
                title="Notifications"
                tooltip={
                  <>
                    <span className="font-medium text-foreground">Read rate:</span>{" "}
                    100 Ã— reads Ã· notification page views (engagement proxy, not
                    delivery rate).
                  </>
                }
              >
                <ul className="text-sm space-y-2">
                  <li>
                    Reads:{" "}
                    <strong>{data.engagement?.notificationReads ?? 0}</strong>
                  </li>
                  <li>
                    Page views:{" "}
                    <strong>{data.engagement?.notificationViews ?? 0}</strong>
                  </li>
                  <li>
                    Read rate:{" "}
                    <strong>{data.engagement?.notificationReadRate ?? 0}%</strong>
                  </li>
                </ul>
              </ChartCard>
              <ChartCard source="posthog"
                title="CSV exports (History / Audit)"
                tooltip={
                  <>
                    From{" "}
                    <code className="rounded bg-muted px-0.5">csv_exported</code>{" "}
                    â€” grouped by{" "}
                    <code className="rounded bg-muted px-0.5">export_type</code>{" "}
                    property.
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "exportType", label: "export_type" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.adminOps?.exportsByType || []}
                  empty="No csv_exported events."
                />
              </ChartCard>
              <ChartCard source="posthog"
                title="Role at login"
                tooltip={
                  <>
                    Parsed from{" "}
                    <code className="rounded bg-muted px-0.5">login_success</code>
                    :{" "}
                    <code className="rounded bg-muted px-0.5">user_role</code>{" "}
                    then <code className="rounded bg-muted px-0.5">role</code>.
                  </>
                }
              >
                <MiniTable
                  columns={[
                    { key: "role", label: "Role" },
                    { key: "count", label: "Count" },
                  ]}
                  rows={data.adminOps?.roleAtLogin || []}
                  empty="No roles on login_success â€” set role or user_role in properties."
                />
              </ChartCard>
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Enterprise PostHog: {error}
        </div>
      ) : null}
    </div>
  );
}
