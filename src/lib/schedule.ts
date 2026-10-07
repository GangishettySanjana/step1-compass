import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ensureSchema, getSql } from "./db";
import { NBME_MILESTONES, SEED_TOPICS, type Difficulty } from "./seed-data";

export const FIRST_PASS_START = "2026-10-07";
export const FIRST_PASS_END = "2026-11-30";
export const REVISION_START = "2026-12-01";

const HARD_TIER: Difficulty[] = ["hard", "very_hard"];
const LIGHT_TIER: Difficulty[] = ["easy", "moderate"];

export type Phase = "first_pass" | "revision";

export function phaseForDate(dateStr: string): Phase {
  return dateStr < REVISION_START ? "first_pass" : "revision";
}

export function targetCountForPhase(phase: Phase): number {
  return phase === "first_pass" ? 3 : 4;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export interface TopicRow {
  id: number;
  name: string;
  system: string;
  system_order: number;
  difficulty: Difficulty;
  status: "pending" | "done";
  assigned_date: string | null;
  deferred_until: string | null;
  done_date: string | null;
  weak: boolean;
}

// Picks `target` topics out of an ordered candidate window, guaranteeing at
// least one "hard/very hard" and one "easy/moderate" topic when the window
// actually contains both tiers — so no day is three brutal topics back to
// back, and no day is wasted on three throwaway ones. Preserves the original
// (system-sweep / weak-first) ordering as much as possible.
export function pickBalanced<T extends { difficulty: Difficulty }>(
  candidates: T[],
  target: number
): T[] {
  if (candidates.length <= target) return candidates;

  const picks: T[] = candidates.slice(0, target);
  const hasTier = (arr: T[], tiers: Difficulty[]) =>
    arr.some((t) => tiers.includes(t.difficulty));

  const ensureTier = (tiers: Difficulty[]) => {
    if (hasTier(picks, tiers)) return;
    const replacementIdx = candidates.findIndex(
      (c) => tiers.includes(c.difficulty) && !picks.includes(c)
    );
    if (replacementIdx === -1) return;
    // Replace the pick from the opposite tier that appears latest in the
    // window (least disruptive to the overall sweep order).
    const oppositeTiers = tiers === HARD_TIER ? LIGHT_TIER : HARD_TIER;
    let swapOutIdx = -1;
    for (let i = picks.length - 1; i >= 0; i--) {
      if (oppositeTiers.includes(picks[i].difficulty)) {
        swapOutIdx = i;
        break;
      }
    }
    if (swapOutIdx === -1) return;
    picks[swapOutIdx] = candidates[replacementIdx];
  };

  ensureTier(HARD_TIER);
  ensureTier(LIGHT_TIER);
  return picks;
}

// Guarded by a single shared promise so concurrent requests (the dashboard
// fires /api/today, /api/progress, and /api/intention in parallel on load)
// can't all race in and seed the ~170 topics multiple times at once.
let seedReady: Promise<void> | null = null;

export function seedIfEmpty(): Promise<void> {
  if (!seedReady) {
    seedReady = (async () => {
      await ensureSchema();
      const sql = getSql();
      const [{ count }] = (await sql`SELECT COUNT(*)::int AS count FROM topics`) as {
        count: number;
      }[];
      if (count > 0) return;

      for (const t of SEED_TOPICS) {
        await sql`
          INSERT INTO topics (name, system, system_order, difficulty)
          VALUES (${t.name}, ${t.system}, ${t.systemOrder}, ${t.difficulty})
        `;
      }
      for (let i = 0; i < NBME_MILESTONES.length; i++) {
        const m = NBME_MILESTONES[i];
        await sql`
          INSERT INTO nbme_results (name, planned_month, sort_order)
          VALUES (${m.name}, ${m.month}, ${i})
        `;
      }
    })();
  }
  return seedReady;
}

const WINDOW_MULTIPLIER = 4;
const MIN_WINDOW = 10;

export async function getOrCreateToday(dateStr: string): Promise<TopicRow[]> {
  await seedIfEmpty();
  const sql = getSql();

  const todayRows = (await sql`
    SELECT * FROM topics WHERE assigned_date = ${dateStr} OR done_date = ${dateStr} ORDER BY id
  `) as TopicRow[];

  const pendingToday = todayRows.filter((r) => r.status === "pending");
  const doneToday = todayRows.filter((r) => r.status === "done");
  const phase = phaseForDate(dateStr);
  const target = targetCountForPhase(phase);
  const needed = target - (pendingToday.length + doneToday.length);

  if (needed > 0) {
    const windowSize = Math.max(needed * WINDOW_MULTIPLIER, MIN_WINDOW);
    const candidates =
      phase === "first_pass"
        ? ((await sql`
            SELECT * FROM topics
            WHERE status = 'pending' AND (deferred_until IS NULL OR deferred_until <= ${dateStr})
            ORDER BY id
            LIMIT ${windowSize}
          `) as TopicRow[])
        : ((await sql`
            SELECT * FROM topics
            WHERE status = 'pending' AND (deferred_until IS NULL OR deferred_until <= ${dateStr})
            ORDER BY weak DESC, id
            LIMIT ${windowSize}
          `) as TopicRow[]);

    const selected = pickBalanced(candidates, needed);
    if (selected.length > 0) {
      const ids = selected.map((s) => s.id);
      await sql`UPDATE topics SET assigned_date = ${dateStr} WHERE id = ANY(${ids})`;
    }
  }

  return (await sql`
    SELECT * FROM topics WHERE assigned_date = ${dateStr} OR done_date = ${dateStr}
    ORDER BY status ASC, id ASC
  `) as TopicRow[];
}

export async function markTopicDone(id: number, dateStr: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE topics SET status = 'done', done_date = ${dateStr}
    WHERE id = ${id} AND status = 'pending'
  `;
}

export async function swapTopicToTomorrow(id: number, dateStr: string): Promise<void> {
  const sql = getSql();
  const tomorrow = format(addDays(new Date(dateStr), 1), "yyyy-MM-dd");
  await sql`
    UPDATE topics SET assigned_date = NULL, deferred_until = ${tomorrow}
    WHERE id = ${id} AND status = 'pending'
  `;
}

export interface ProgressStats {
  totalTopics: number;
  series: { date: string; ideal: number; actual: number }[];
  perSystem: { system: string; systemOrder: number; done: number; total: number }[];
  nbme: {
    id: number;
    name: string;
    plannedMonth: string;
    examDate: string | null;
    score: number | null;
  }[];
  doneCount: number;
  todayISO: string;
  firstPassEnd: string;
}

export async function getProgressStats(dateStr: string): Promise<ProgressStats> {
  await seedIfEmpty();
  const sql = getSql();

  const [{ count: totalTopics }] = (await sql`
    SELECT COUNT(*)::int AS count FROM topics
  `) as { count: number }[];

  const doneRows = (await sql`
    SELECT done_date::text AS done_date, COUNT(*)::int AS n
    FROM topics WHERE status = 'done' AND done_date IS NOT NULL
    GROUP BY done_date
  `) as { done_date: string; n: number }[];
  const doneByDate = new Map(doneRows.map((r) => [r.done_date, r.n]));

  const start = FIRST_PASS_START;
  const end = FIRST_PASS_END;
  const totalDays = Math.max(differenceInCalendarDays(new Date(end), new Date(start)), 1);
  const lastDate = dateStr > end ? dateStr : end;

  const series: ProgressStats["series"] = [];
  let cursor = start;
  let cumulative = 0;
  const sortedDoneDates = [...doneByDate.keys()].sort();
  let doneDateIdx = 0;

  while (cursor <= lastDate) {
    while (doneDateIdx < sortedDoneDates.length && sortedDoneDates[doneDateIdx] <= cursor) {
      cumulative += doneByDate.get(sortedDoneDates[doneDateIdx]) ?? 0;
      doneDateIdx++;
    }
    const elapsed = differenceInCalendarDays(new Date(cursor), new Date(start));
    const idealFraction = Math.min(Math.max(elapsed / totalDays, 0), 1);
    series.push({
      date: cursor,
      ideal: Math.round(idealFraction * totalTopics),
      actual: cumulative,
    });
    cursor = format(addDays(new Date(cursor), 1), "yyyy-MM-dd");
  }

  const perSystem = (await sql`
    SELECT system, system_order AS "systemOrder",
      COUNT(*) FILTER (WHERE status = 'done')::int AS done,
      COUNT(*)::int AS total
    FROM topics GROUP BY system, system_order ORDER BY system_order
  `) as ProgressStats["perSystem"];

  const nbmeRows = (await sql`
    SELECT id, name, planned_month AS "plannedMonth", exam_date::text AS "examDate", score
    FROM nbme_results ORDER BY sort_order
  `) as ProgressStats["nbme"];

  const [{ count: doneCount }] = (await sql`
    SELECT COUNT(*)::int AS count FROM topics WHERE status = 'done'
  `) as { count: number }[];

  return {
    totalTopics,
    series,
    perSystem,
    nbme: nbmeRows,
    doneCount,
    todayISO: dateStr,
    firstPassEnd: FIRST_PASS_END,
  };
}

export async function getWeakTopicPool(): Promise<{ id: number; name: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, name FROM topics WHERE status = 'done' ORDER BY done_date DESC LIMIT 60
  `) as { id: number; name: string }[];
}

export async function markTopicsWeak(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const sql = getSql();
  await sql`UPDATE topics SET weak = TRUE WHERE name = ANY(${names})`;
}

export async function recordNbmeScore(
  id: number,
  score: number | null,
  examDate: string | null
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE nbme_results SET score = ${score}, exam_date = ${examDate} WHERE id = ${id}
  `;
}
