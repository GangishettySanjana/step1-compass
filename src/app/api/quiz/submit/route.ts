import { NextResponse } from "next/server";
import { getSql, ensureSchema } from "@/lib/db";
import { markTopicsWeak } from "@/lib/schedule";

interface SubmitBody {
  periodStart: string;
  periodEnd: string;
  topics: string[];
  answers: { topic: string; correct: boolean }[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as SubmitBody;
  if (!body.periodStart || !body.periodEnd || !Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await ensureSchema();
  const sql = getSql();

  const total = body.answers.length;
  const score = body.answers.filter((a) => a.correct).length;
  const weakTopics = [...new Set(body.answers.filter((a) => !a.correct).map((a) => a.topic))];

  await sql`
    INSERT INTO quiz_results (period_start, period_end, score, total, topics_covered, weak_topics)
    VALUES (${body.periodStart}, ${body.periodEnd}, ${score}, ${total}, ${body.topics}, ${weakTopics})
  `;

  await markTopicsWeak(weakTopics);

  return NextResponse.json({ ok: true, score, total, weakTopics });
}
