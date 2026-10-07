"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import rough from "roughjs";
import type { ProgressStats } from "@/lib/schedule";

const W = 400;
const H = 190;
const PAD_LEFT = 30;
const PAD_RIGHT = 20;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

export function ProgressGraph({ stats }: { stats: ProgressStats | null }) {
  const [expanded, setExpanded] = useState(false);

  const chart = useMemo(() => {
    if (!stats || stats.series.length === 0) return null;
    const gen = rough.generator();
    const maxVal = Math.max(stats.totalTopics, 1);
    const innerW = W - PAD_LEFT - PAD_RIGHT;
    const innerH = H - PAD_TOP - PAD_BOTTOM;
    const n = stats.series.length;
    const xAt = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const yAt = (v: number) => PAD_TOP + innerH - (v / maxVal) * innerH;

    const idealPoints: [number, number][] = stats.series.map((s, i) => [xAt(i), yAt(s.ideal)]);
    const actualPoints: [number, number][] = stats.series.map((s, i) => [xAt(i), yAt(s.actual)]);

    // Ideal pace is mathematically a straight line — draw it as one clean
    // hand-drawn stroke between the two endpoints rather than tracing every
    // daily point, which otherwise compounds sketch-jitter into noise.
    const idealStart = idealPoints[0];
    const idealEnd = idealPoints.at(-1)!;
    const idealDrawable = gen.line(idealStart[0], idealStart[1], idealEnd[0], idealEnd[1], {
      stroke: "var(--muted)",
      strokeWidth: 1.5,
      roughness: 0.8,
      bowing: 0.3,
    });
    // Actual is a real cumulative step series, so it needs every point —
    // linearPath (straight sketchy segments) reads calmer at this density
    // than a splined curve with roughness layered on top.
    const actualDrawable = gen.linearPath(actualPoints, {
      stroke: "var(--accent)",
      strokeWidth: 2.5,
      roughness: 0.9,
      bowing: 0.3,
    });

    const lastActual = actualPoints.at(-1);
    const dot = lastActual
      ? gen.circle(lastActual[0], lastActual[1], 8, {
          fill: "var(--accent)",
          fillStyle: "solid",
          stroke: "var(--accent)",
          roughness: 1.5,
        })
      : null;

    const paths = [
      ...gen.toPaths(idealDrawable),
      ...gen.toPaths(actualDrawable),
      ...(dot ? gen.toPaths(dot) : []),
    ];

    const tickCount = Math.min(6, n);
    const tickIdxs = [...new Set(
      Array.from({ length: tickCount }, (_, k) =>
        Math.round((k / Math.max(tickCount - 1, 1)) * (n - 1))
      )
    )];
    const ticks = tickIdxs.map((i) => ({ x: xAt(i), label: stats.series[i].date.slice(5) }));

    const todayIdx = stats.series.findIndex((s) => s.date === stats.todayISO);
    const todayX = todayIdx >= 0 ? xAt(todayIdx) : null;
    const todayPoint = todayIdx >= 0 ? stats.series[todayIdx] : stats.series.at(-1);
    const behind = stats.doneCount < (todayPoint?.ideal ?? 0);

    return { paths, ticks, todayX, behind, maxVal };
  }, [stats]);

  if (!stats || !chart) {
    return (
      <div
        className="rounded-2xl p-6 h-64 animate-pulse"
        style={{ background: "var(--surface-muted)" }}
      />
    );
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--surface)" }}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Pace to Nov 30
        </h2>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            background: chart.behind ? "var(--rose-soft)" : "var(--accent-soft)",
            color: chart.behind ? "var(--rose)" : "var(--accent)",
          }}
        >
          {stats.doneCount} / {stats.totalTopics} topics
          {chart.behind ? ", behind pace" : ", on pace"}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pace chart: ideal vs actual topics completed">
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={PAD_LEFT - 6}
            y={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * (1 - f)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="9"
            fill="var(--muted)"
          >
            {Math.round(chart.maxVal * f)}
          </text>
        ))}

        {chart.todayX != null && (
          <line
            x1={chart.todayX}
            y1={PAD_TOP}
            x2={chart.todayX}
            y2={H - PAD_BOTTOM}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {chart.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill ?? "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {chart.ticks.map((t, i) => (
          <text key={i} x={t.x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">
            {t.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ background: "var(--muted)" }} />
          Ideal pace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ background: "var(--accent)" }} />
          Actual
        </span>
      </div>

      {stats.nbme.length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
            NBME practice exams: scheduled checkpoints, not daily tasks. Log a score once taken.
          </p>
          <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mt-5 pt-4 text-left"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          All 17 subjects
        </span>
        <ChevronDown
          size={16}
          style={{
            color: "var(--muted)",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {stats.perSystem.map((s) => (
            <div key={s.system}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--foreground)" }}>
                  {s.system}
                </span>
                <span className="text-xs shrink-0 ml-2" style={{ color: "var(--muted)" }}>
                  {s.done}/{s.total}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
