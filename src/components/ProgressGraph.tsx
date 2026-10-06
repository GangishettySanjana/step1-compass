"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProgressStats } from "@/lib/schedule";

export function ProgressGraph({ stats }: { stats: ProgressStats | null }) {
  if (!stats) {
    return (
      <div
        className="rounded-2xl p-6 h-64 animate-pulse"
        style={{ background: "var(--surface-muted)" }}
      />
    );
  }

  const chartData = stats.series.map((s) => ({
    date: s.date.slice(5), // MM-DD
    Ideal: s.ideal,
    Actual: s.actual,
  }));

  const behind = stats.doneCount < (stats.series.at(-1)?.ideal ?? 0);

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--surface)" }}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Pace to Nov 30
        </h2>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            background: behind ? "var(--rose-soft)" : "var(--accent-soft)",
            color: behind ? "var(--rose)" : "var(--accent)",
          }}
        >
          {stats.doneCount} / {stats.totalTopics} topics
          {behind ? " — behind pace" : " — on pace"}
        </span>
      </div>

      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <ReferenceLine
              x={stats.todayISO.slice(5)}
              stroke="var(--muted)"
              strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="Ideal"
              stroke="var(--muted)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Actual"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 space-y-2">
        {stats.perSystem.map((s) => (
          <div key={s.system} className="flex items-center gap-3">
            <span
              className="text-xs w-40 shrink-0 truncate"
              style={{ color: "var(--muted)" }}
              title={s.system}
            >
              {s.system}
            </span>
            <div
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--surface-muted)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${s.total ? (s.done / s.total) * 100 : 0}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <span className="text-xs w-10 text-right" style={{ color: "var(--muted)" }}>
              {s.done}/{s.total}
            </span>
          </div>
        ))}
      </div>

      {stats.nbme.length > 0 && (
        <div className="mt-5 pt-4 flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          {stats.nbme.map((n) => (
            <span
              key={n.id}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                background: n.score != null ? "var(--accent-soft)" : "var(--surface-muted)",
                color: n.score != null ? "var(--accent)" : "var(--muted)",
              }}
            >
              {n.name}
              {n.score != null ? ` · ${n.score}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
