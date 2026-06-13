"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const scoreColors = {
  "Core launch": "#38bdf8",
  "Pre-launch": "#f59e0b",
  "Developer audience": "#22c55e",
  "Technical validation": "#a78bfa",
  "Community feedback": "#fb7185",
  "Founder story": "#14b8a6",
  "Content-led launch": "#eab308",
  "Long-tail SEO": "#60a5fa",
  "Revenue experiment": "#f97316",
};

export function DistributionPriorityChart({ platforms }) {
  const data = platforms.map((platform) => ({
    name: platform.name,
    score: platform.score,
    priority: platform.priority,
    fill: scoreColors[platform.priority] || "#94a3b8",
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 12, right: 16, top: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="currentColor"
            className="text-border"
          />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={118}
            tick={{ fill: "currentColor", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload;
              return (
                <div className="rounded-md border bg-background/95 p-3 text-xs shadow-xl">
                  <p className="font-semibold">{row.name}</p>
                  <p className="mt-1 text-muted-foreground">{row.priority}</p>
                  <p className="mt-2 font-mono">Score {row.score}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
