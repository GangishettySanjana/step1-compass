import { addDays, format } from "date-fns";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getSetting } from "@/lib/db";
import { generateQuiz } from "@/lib/openrouter";
import { getQuizSource, todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();

  const cadenceDaysRaw = await getSetting("quiz_cadence_days");
  const cadenceDays = cadenceDaysRaw ? Number(cadenceDaysRaw) : 7;

  const today = todayISO();
  const periodEnd = today;
  const periodStart = format(addDays(new Date(periodEnd), -cadenceDays), "yyyy-MM-dd");

  const { topics, isPreview } = await getQuizSource(periodStart, periodEnd, today);
  const topicNames = topics.map((t) => t.name);

  try {
    const questions = await generateQuiz(topics);
    return NextResponse.json({
      periodStart,
      periodEnd,
      topics: topicNames,
      questions,
      isPreview,
    });
  } catch (err) {
    return NextResponse.json(
      {
        periodStart,
        periodEnd,
        topics: topicNames,
        questions: [],
        isPreview,
        error: err instanceof Error ? err.message : "Quiz generation failed",
      },
      { status: 502 }
    );
  }
}
