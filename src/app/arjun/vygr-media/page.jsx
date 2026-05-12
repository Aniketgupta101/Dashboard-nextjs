"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Users,
  UsersRound,
  MessageSquareText,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ChartCard, COLORS } from "@/components/ui/metric-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEnterpriseData } from "@/hooks/use-enterprise-data";
import { getDateRange } from "@/lib/date-utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const VYGR_ENTERPRISE_ID = "95";
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
];

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={`mt-2 text-2xl font-semibold tracking-tight ${accent || ""}`}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildVygrActionables(data) {
  const users = data?.userActivity || [];
  const enterprisePrompts = users.reduce((sum, user) => sum + Number(user.promptCount || 0), 0);
  const consumerPrompts = users.reduce((sum, user) => sum + Number(user.consumerPrompts || 0), 0);
  const consumerOnly = users.filter(
    (user) => Number(user.consumerPrompts || 0) > 0 && Number(user.promptCount || 0) === 0,
  ).length;
  const enterpriseOnly = users.filter(
    (user) => Number(user.promptCount || 0) > 0 && Number(user.consumerPrompts || 0) === 0,
  ).length;
  const dualMode = users.filter(
    (user) => Number(user.promptCount || 0) > 0 && Number(user.consumerPrompts || 0) > 0,
  ).length;
  const topIntent = data?.intents?.[0];

  return [
    {
      title: "Separate enterprise adoption from consumer fallback",
      metric: `${enterprisePrompts.toLocaleString()} enterprise / ${consumerPrompts.toLocaleString()} consumer prompts`,
      action:
        consumerPrompts > 0
          ? "Some VYGR emails still use the consumer product. Click those users and check if enterprise mode is hard to find, missing history, or not matching their daily workflow."
          : "Matched VYGR emails are not showing consumer fallback in this range; keep the focus on enterprise activation depth.",
    },
    {
      title: "Target migration for mixed-mode users",
      metric: `${dualMode} dual-mode, ${consumerOnly} consumer-only`,
      action:
        dualMode + consumerOnly > 0
          ? "Prioritize these members for migration messaging and enterprise-mode defaults because their email proves they already have intent outside the enterprise workspace."
          : "No mixed-mode or consumer-only users are visible in this range; do not over-invest in migration UX until the signal appears.",
    },
    {
      title: "Use the dominant intent as the pilot narrative",
      metric: topIntent ? `${topIntent.intent}: ${topIntent.count}` : "No intent data",
      action: topIntent
        ? `Package ${topIntent.intent} examples for VYGR admins and use that use case in enablement, not generic prompt education.`
        : "Intent coverage is thin; verify enhanced prompt instrumentation before drawing workflow conclusions.",
    },
    {
      title: "Find enterprise-only champions",
      metric: `${enterpriseOnly} enterprise-only users`,
      action:
        enterpriseOnly > 0
          ? "Use these members as champion accounts: inspect their prompt patterns and turn repeated behavior into templates for the rest of VYGR."
          : "Enterprise-only champions are not obvious yet; focus on first successful enterprise prompt per member.",
    },
  ];
}

function VygrUserDetailSheet({ open, onOpenChange, user, detail, loading, error }) {
  const profile = detail?.profile || user || {};
  const summary = detail?.summary || {};
  const splitData = [
    { name: "Enterprise", value: Number(summary.enterprisePrompts || 0) },
    { name: "Consumer", value: Number(summary.consumerPrompts || 0) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border/50 pr-10">
          <SheetTitle>{profile.name || "VYGR user"}</SheetTitle>
          <SheetDescription>{profile.email || "No email"}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : error ? (
          <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : detail ? (
          <div className="space-y-5 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard title="Enterprise Prompts" value={summary.enterprisePrompts || 0} icon={MessageSquareText} />
              <StatCard title="Consumer Prompts" value={summary.consumerPrompts || 0} icon={UsersRound} />
              <StatCard title="Enterprise Share" value={`${summary.enterpriseShare || 0}%`} icon={Building2} />
              <StatCard title="Active Days" value={summary.enterpriseActiveDays || 0} icon={Zap} />
            </div>

            <div className="rounded-xl border border-border/50 bg-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product usage distinction
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Same email match: enterprise mode usage is counted from the VYGR
                enterprise database; consumer usage is counted from the consumer
                product database by email.
              </p>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p>Enterprise last active: <span className="text-muted-foreground">{fmtDate(summary.lastActive)}</span></p>
                <p>Consumer last active: <span className="text-muted-foreground">{fmtDate(summary.consumerLastActive)}</span></p>
                <p>Enterprise status: <span className="text-muted-foreground">{profile.isActive ? "Active" : "Inactive"}</span></p>
                <p>Consumer status: <span className="text-muted-foreground">{summary.consumerStatus || "No matched consumer account"}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Enterprise vs Consumer Split" source="db">
                <ChartContainer
                  config={{
                    Enterprise: { label: "Enterprise", color: COLORS.primary },
                    Consumer: { label: "Consumer", color: COLORS.warning },
                  }}
                  className="h-[220px] w-full"
                >
                  <PieChart>
                    <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={42}>
                      <Cell fill={COLORS.primary} />
                      <Cell fill={COLORS.warning} />
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard title="Enterprise Prompt Trend" source="db">
                <ChartContainer
                  config={{ prompts: { label: "Prompts", color: COLORS.primary } }}
                  className="h-[220px] w-full"
                >
                  <AreaChart data={detail.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="prompts" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                ["Intent mix", detail.intents],
                ["Domain mix", detail.domains],
                ["Mode mix", detail.modes],
              ].map(([title, rows]) => (
                <div key={title} className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">{title}</p>
                  {rows?.length ? (
                    <div className="space-y-2">
                      {rows.slice(0, 5).map((row) => (
                        <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{row.name}</span>
                          <span className="font-mono">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No data</p>
                  )}
                </div>
              ))}
            </div>

            <ChartCard title="Recent Enterprise Prompts" source="db">
              <div className="space-y-3">
                {(detail.recentPrompts || []).map((prompt) => (
                  <div key={prompt.promptId} className="rounded-lg border border-border/40 bg-background/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{fmtDate(prompt.createdAt)}</span>
                      <Badge variant="outline" className="text-[10px]">{prompt.intent}</Badge>
                      <Badge variant="outline" className="text-[10px]">{prompt.mode}</Badge>
                      <span>{prompt.totalToken || 0} tokens</span>
                    </div>
                    <p className="text-sm leading-relaxed">{prompt.prompt || "No prompt text"}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function UserActivityTable({ users, onSelectUser }) {
  const [sortKey, setSortKey] = useState("promptCount");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    let rows = users.filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.userId?.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "lastActive" || sortKey === "joinedAt") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (av == null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === "asc" ? Infinity : -Infinity;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return rows;
  }, [users, sortKey, sortDir, search]);

  function toggle(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function arrow(key) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function fmt(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        No user data available for this period.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                  onClick={() => toggle("joinedAt")}
                >
                  Joined{arrow("joinedAt")}
                </th>
                <th
                  className="px-4 py-3 text-right font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                  onClick={() => toggle("promptCount")}
                >
                  Enterprise{arrow("promptCount")}
                </th>
                <th
                  className="px-4 py-3 text-right font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                  onClick={() => toggle("consumerPrompts")}
                >
                  Consumer{arrow("consumerPrompts")}
                </th>
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap hover:text-foreground"
                  onClick={() => toggle("lastActive")}
                >
                  Last Active{arrow("lastActive")}
                </th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => (
                <tr
                  key={u.userId || i}
                  className="cursor-pointer border-t border-border/40 even:bg-muted/20 hover:bg-muted/40"
                  onClick={() => onSelectUser?.(u)}
                  title="Open VYGR user behavior detail"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium leading-tight text-left underline-offset-4 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectUser?.(u);
                      }}
                    >
                      {u.name || <span className="text-muted-foreground italic">Unnamed</span>}
                    </button>
                    {u.email && (
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmt(u.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {u.promptCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {(u.consumerPrompts || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmt(u.lastActive)}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-300/40">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
          {sorted.length} user{sorted.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </div>
      </div>
    </div>
  );
}

export default function VygrMediaPage() {
  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const { data, isLoading, error, refetch } = useEnterpriseData(
    dateFilter,
    customDateRange,
    VYGR_ENTERPRISE_ID,
  );

  const summary = data?.summary || {};
  const actionables = useMemo(() => buildVygrActionables(data), [data]);

  const teamChartData = useMemo(
    () =>
      (data?.topTeams || []).slice(0, 8).map((t) => ({
        name: t.teamName,
        prompts: t.enhancedPrompts,
      })),
    [data?.topTeams],
  );

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

  const hourlyData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, "0")}:00`,
        count: (data?.hourlyActivity || []).find((h) => h.hour === i)?.count || 0,
      })),
    [data?.hourlyActivity],
  );

  const dowData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        day: DOW_LABELS[i],
        count: (data?.dowActivity || []).find((d) => d.dow === i)?.count || 0,
      })),
    [data?.dowActivity],
  );

  const engagementRate =
    summary.activeUsers > 0
      ? ((summary.activePromptUsers / summary.activeUsers) * 100).toFixed(0)
      : 0;

  const openUserDetail = (user) => {
    setSelectedUser(user);
    setUserDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    const range =
      dateFilter === "Custom" && customDateRange?.from && customDateRange?.to
        ? {
            startDate: customDateRange.from,
            endDate: new Date(customDateRange.to),
          }
        : getDateRange(dateFilter);
    if (range.endDate) range.endDate.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({ enterpriseId: VYGR_ENTERPRISE_ID });
    if (range.startDate) params.set("startDate", range.startDate.toISOString());
    if (range.endDate) params.set("endDate", range.endDate.toISOString());

    fetch(`/api/enterprise/users/${encodeURIComponent(user.userId)}?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUserDetail(json.data);
        else setDetailError(json.error || "Unable to load user detail");
      })
      .catch((e) => setDetailError(e.message))
      .finally(() => setDetailLoading(false));
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              VYGR Media
            </h1>
            <Badge
              variant="outline"
              className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-400/30"
            >
              Enterprise ID 95
            </Badge>
            <Badge variant="outline" className="text-[11px] bg-muted/50">
              vygr-media
            </Badge>
          </div>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Dedicated analytics view — scoped exclusively to VYGR Media.
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
          <button
            onClick={refetch}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Data warning: {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats — 6 cards */}
          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Overview
            </h2>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Total Active Users"
                value={summary.activeUsers ?? 0}
                subtitle="isActive = true in enterprise"
                icon={Users}
              />
              <StatCard
                title="Prompt-Active Users"
                value={summary.activePromptUsers ?? 0}
                subtitle={`${engagementRate}% engagement rate`}
                icon={Zap}
                accent="text-blue-500"
              />
              <StatCard
                title="Total Prompts"
                value={(summary.promptsInRange ?? 0).toLocaleString()}
                subtitle="in selected period"
                icon={MessageSquareText}
              />
              <StatCard
                title="Prompts / Active User"
                value={(summary.promptsPerActiveUser ?? 0).toFixed(1)}
                subtitle="avg engagement intensity"
                icon={TrendingUp}
              />
              <StatCard
                title="Teams"
                value={summary.teams ?? 0}
                subtitle="active teams"
                icon={Building2}
              />
              <StatCard
                title="Onboarding Rate"
                value={`${(summary.onboardingRate ?? 0).toFixed(1)}%`}
                subtitle={`${summary.onboardedEnterprises ?? 0} completed`}
                icon={UsersRound}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Insight Actionables
            </h2>
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              {actionables.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border/50 bg-card/60 p-4"
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-lg font-semibold text-blue-500">
                    {item.metric}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.action}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Charts */}
          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Prompt Activity
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <ChartCard
                title="Daily Prompts & Active Users"
                tooltip="Daily prompt volume and distinct active users for VYGR Media"
                source="db"
              >
                <ChartContainer
                  config={{
                    prompts: { label: "Prompts", color: COLORS.primary },
                    users: { label: "Active Users", color: COLORS.success },
                  }}
                  className="h-[240px] w-full"
                >
                  <ComposedChart data={data.dailyPrompts || []}>
                    <defs>
                      <linearGradient id="vygrPrompts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="prompts"
                      stroke={COLORS.primary}
                      fill="url(#vygrPrompts)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="users"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Top Teams by Enhanced Prompts"
                tooltip="Which VYGR Media teams are generating the most enhanced prompts"
                source="db"
              >
                <ChartContainer
                  config={{
                    prompts: { label: "Enhanced Prompts", color: COLORS.info },
                  }}
                  className="h-[240px] w-full"
                >
                  <BarChart data={teamChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="prompts" fill={COLORS.info} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Intent & Governance
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {intentData.length > 0 && (
                <ChartCard
                  title="Intent Mix"
                  tooltip="What VYGR Media users ask the assistant most"
                  source="db"
                >
                  <ChartContainer
                    config={Object.fromEntries(
                      intentData.map((i, idx) => [
                        i.name,
                        { label: i.name, color: PIE_COLORS[idx % PIE_COLORS.length] },
                      ]),
                    )}
                    className="h-[240px] w-full flex justify-center"
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
              )}

              {moderationData.length > 0 && (
                <ChartCard
                  title="Moderation Decision Actions"
                  tooltip="Moderation outcomes for VYGR Media prompts"
                  source="db"
                >
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
              )}

              {queueData.length > 0 && (
                <ChartCard
                  title="Guardrail Queue Status"
                  tooltip="Approval queue status for VYGR Media"
                  source="db"
                >
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
              )}
            </div>
          </section>

          {/* Usage Patterns — hourly & DOW */}
          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Usage Patterns
            </h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <ChartCard
                title="Prompts by Hour of Day"
                tooltip="When VYGR Media users send prompts throughout the day"
                source="db"
              >
                <ChartContainer
                  config={{ count: { label: "Prompts", color: COLORS.primary } }}
                  className="h-[220px] w-full"
                >
                  <BarChart data={hourlyData} margin={{ left: -16, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="Prompts" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              <ChartCard
                title="Prompts by Day of Week"
                tooltip="Which days VYGR Media users are most active"
                source="db"
              >
                <ChartContainer
                  config={{ count: { label: "Prompts", color: COLORS.warning } }}
                  className="h-[220px] w-full"
                >
                  <BarChart data={dowData} margin={{ left: -16, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.warning} name="Prompts" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </section>

          {/* Team breakdown table */}
          {(data.topTeams || []).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Team Breakdown
              </h2>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Team</th>
                        <th className="px-4 py-3 text-right font-medium">Enhanced Prompts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.topTeams || []).map((team, i) => (
                        <tr key={i} className="border-t border-border/40 even:bg-muted/20">
                          <td className="px-4 py-3">{team.teamName}</td>
                          <td className="px-4 py-3 text-right font-mono">{team.enhancedPrompts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* User Activity */}
          <section>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              User Activity
            </h2>
            <UserActivityTable
              users={data.userActivity || []}
              onSelectUser={openUserDetail}
            />
          </section>

          <VygrUserDetailSheet
            open={Boolean(selectedUser)}
            onOpenChange={(open) => {
              if (!open) setSelectedUser(null);
            }}
            user={selectedUser}
            detail={userDetail}
            loading={detailLoading}
            error={detailError}
          />
        </>
      )}
    </div>
  );
}
