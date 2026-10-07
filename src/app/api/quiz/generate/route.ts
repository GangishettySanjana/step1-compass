import { addDays, format } from "date-fns";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getSetting } from "@/lib/db";
import { getSql, ensureSchema } from "@/lib/db";
import { generateQuiz } from "@/lib/openrouter";
import { todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();
  await ensureSchema();
  const sql = getSql();

  const cadenceDaysRaw = await getSetting("quiz_cadence_days");
  const cadenceDays = cadenceDaysRaw ? Number(cadenceDaysRaw) : 7;

  const periodEnd = todayISO();
  const periodStart = format(addDays(new Date(periodEnd), -cadenceDays), "yyyy-MM-dd");

  const rows = (await sql`
    SELECT DISTINCT name FROM topics
    WHERE status = 'done' AND done_date BETWEEN ${periodStart} AND ${periodEnd}
  `) as { name: string }[];
  const topicNames = rows.map((r) => r.name);

  if (topicNames.length === 0) {
    return NextResponse.json({
      periodStart,
      periodEnd,
      topics: [],
      questions: [],
      message: "No topics completed yet in this window, nothing to quiz on.",
    });
  }

  try {
    const questions = await generateQuiz(topicNames);
    return NextResponse.json({ periodStart, periodEnd, topics: topicNames, questions });
  } catch (err) {
    return NextResponse.json(
      {
        periodStart,
        periodEnd,
        topics: topicNames,
        questions: [],
        error: err instanceof Error ? err.message : "Quiz generation failed",
      },
      { status: 502 }
    );
  }
}
