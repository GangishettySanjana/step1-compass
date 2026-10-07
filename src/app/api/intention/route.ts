import { NextResponse } from "next/server";
import { connection } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";
import { generateIntention } from "@/lib/openrouter";
import { getOrCreateToday, todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();
  const date = todayISO();
  await ensureSchema();
  const sql = getSql();

  const cached = (await sql`SELECT text FROM intention_cache WHERE for_date = ${date}`) as {
    text: string;
  }[];
  if (cached.length > 0) {
    return NextResponse.json({ date, text: cached[0].text });
  }

  const topics = await getOrCreateToday(date);
  const names = topics.map((t) => t.name);

  let text: string;
  try {
    text = names.length > 0 ? await generateIntention(names) : "Today's a light day, a good day to catch up or get ahead.";
  } catch {
    // Free-tier model hiccup or missing key — fall back gracefully rather
    // than breaking the dashboard.
    text =
      names.length > 0
        ? `Today's focus: ${names.join(", ")}. One step closer to Nov 30.`
        : "Open the app, see what's next, and take it one topic at a time.";
  }

  await sql`
    INSERT INTO intention_cache (for_date, text) VALUES (${date}, ${text})
    ON CONFLICT (for_date) DO UPDATE SET text = EXCLUDED.text
  `;

  return NextResponse.json({ date, text });
}
