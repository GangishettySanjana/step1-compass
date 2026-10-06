import { NextResponse } from "next/server";
import { getOrCreateToday, swapTopicToTomorrow, todayISO } from "@/lib/schedule";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = Number(id);
  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }
  const date = todayISO();
  await swapTopicToTomorrow(topicId, date);
  // Reflow: immediately backfill today's slot that just opened up.
  const topics = await getOrCreateToday(date);
  return NextResponse.json({ ok: true, topics });
}
