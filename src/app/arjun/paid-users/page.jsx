"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Crown,
  Clock,
  MessageSquare,
  Zap,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ── colour palette ─────────────────────────────────────────────────────────
const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
];

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${accent || ""}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

function ChartBox({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-border/50 bg-card/60 p-4 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

function statusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("pro") || s.includes("paid") || s.includes("premium")) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[11px]">
        {status}
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{name}</p>
      <p>{value?.toLocaleString()}</p>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function PaidUsersPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "totalPrompts", dir: "desc" });

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/arjun/paid-users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const users = data?.users || [];
  const an = data?.analytics || {};

  // Derived stats
  const totalPrompts = useMemo(() => users.reduce((s, u) => s + u.totalPrompts, 0), [users]);
  const avgPrompts = users.length > 0 ? Math.round(totalPrompts / users.length) : 0;
  const activeThisMonth = useMemo(
    () =>
      users.filter((u) => {
        if (!u.lastActive) return false;
        const d = new Date(u.lastActive);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        return d >= cutoff;
      }).length,
    [users],
  );
  const powerUsers = useMemo(
    () => users.filter((u) => u.totalPrompts >= 20).length,
    [users],
  );

  // Table filter + sort
  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = search.toLowerCase();
        return (
          !q ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.status || "").toLowerCase().includes(q)
        );
      }),
    [users, search],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const { key, dir } = sort;
        let av = a[key] ?? "";
        let bv = b[key] ?? "";
        if (key === "totalPrompts") { av = Number(av); bv = Number(bv); }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av === bv) return 0;
        const r = av < bv ? -1 : 1;
        return dir === "asc" ? r : -r;
      }),
    [filtered, sort],
  );

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );

  // Chart data preparation
  const hourlyData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, "0")}:00`,
        count: (an.hourly?.find((h) => h.hour === i)?.count) || 0,
      })),
    [an.hourly],
  );

  const dowData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        day: DOW_LABELS[i],
        count: (an.dow?.find((d) => d.dow === i)?.count) || 0,
      })),
    [an.dow],
  );

  // ── loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Paid Users</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Paid Users</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Paid Users</h1>
            <Badge variant="outline" className="text-[11px] bg-muted/50">
              Source: DB / userstatus
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Users with pro / paid / premium status. Internal test accounts excluded.
          </p>
        </div>
        <button
          onClick={load}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Summary stats ── */}
      <section>
        <SectionHeading>Overview</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Paid Users" value={users.length} icon={Users} />
          <StatCard label="Active Last 30d" value={activeThisMonth} sub={`${users.length > 0 ? Math.round((activeThisMonth / users.length) * 100) : 0}% retention`} icon={Clock} />
          <StatCard label="Total Prompts" value={totalPrompts.toLocaleString()} icon={MessageSquare} />
          <StatCard label="Avg Prompts / User" value={avgPrompts.toLocaleString()} icon={Crown} />
          <StatCard label="Power Users" value={powerUsers} sub="≥ 20 prompts" icon={TrendingUp} accent="text-amber-500" />
          <StatCard
            label="Avg Tokens / Prompt"
            value={(an.tokens?.avg_total_tokens || 0).toLocaleString()}
            sub={`${((an.tokens?.sum_tokens || 0) / 1_000_000).toFixed(1)}M total`}
            icon={Zap}
            accent="text-blue-500"
          />
        </div>
      </section>

      {/* ── Activity over time ── */}
      <section>
        <SectionHeading>Activity Trend (last 90 days)</SectionHeading>
        <ChartBox title="Daily Prompts & Active Paid Users">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={an.daily || []} margin={{ left: -10, right: 4 }}>
              <defs>
                <linearGradient id="gPrompts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="l" type="monotone" dataKey="prompts" stroke="#3b82f6" fill="url(#gPrompts)" strokeWidth={2} name="Prompts" />
              <Area yAxisId="r" type="monotone" dataKey="active_users" stroke="#22c55e" fill="url(#gUsers)" strokeWidth={2} name="Active Users" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
      </section>

      {/* ── Time patterns ── */}
      <section>
        <SectionHeading>Usage Patterns</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartBox title="Prompts by Hour of Day">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData} margin={{ left: -20, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Prompts" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                  {hourlyData.map((_, i) => (
                    <Cell key={i} fill={i >= 9 && i <= 17 ? "#3b82f6" : "#3b82f640"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Prompts by Day of Week">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowData} margin={{ left: -20, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Prompts" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </section>

      {/* ── Prompt characteristics ── */}
      <section>
        <SectionHeading>Prompt Characteristics</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Intent */}
          <ChartBox title="Top Intents">
            {(an.intents || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={an.intents} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={32} paddingAngle={2}>
                    {(an.intents || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No data</p>
            )}
          </ChartBox>

          {/* Complexity */}
          <ChartBox title="Complexity Mix">
            {(an.complexities || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={an.complexities} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={32} paddingAngle={2}>
                    {(an.complexities || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No data</p>
            )}
          </ChartBox>

          {/* Mode */}
          <ChartBox title="Mode Distribution">
            {(an.modes || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={an.modes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={32} paddingAngle={2}>
                    {(an.modes || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No data</p>
            )}
          </ChartBox>
        </div>
      </section>

      {/* ── Domain breakdown ── */}
      {(an.domains || []).length > 0 && (
        <section>
          <SectionHeading>Domain Breakdown</SectionHeading>
          <ChartBox title="Top Prompt Domains">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={an.domains}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Prompts" fill="#a855f7" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </section>
      )}

      {/* ── User table ── */}
      <section>
        <SectionHeading>User Roster</SectionHeading>
        <div className="space-y-3">
          <Input
            placeholder="Search by name, email, or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <ScrollArea className="h-[480px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    {[
                      { key: "name", label: "NAME" },
                      { key: "email", label: "EMAIL" },
                      { key: "status", label: "STATUS" },
                      { key: "joinedDate", label: "JOINED" },
                      { key: "totalPrompts", label: "PROMPTS" },
                      { key: "lastActive", label: "LAST ACTIVE" },
                    ].map(({ key, label }) => (
                      <TableHead
                        key={key}
                        className="font-bold text-foreground cursor-pointer select-none"
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {sort.key === key && (
                          <span className="ml-1 text-muted-foreground">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length > 0 ? (
                    sorted.map((u) => (
                      <TableRow
                        key={u.userId}
                        className="even:bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>{statusBadge(u.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.joinedDate || "—"}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {u.totalPrompts.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.lastActive || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {search ? "No users match your search." : "No paid users found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {sorted.length} of {users.length} paid users
          </p>
        </div>
      </section>
    </div>
  );
}
