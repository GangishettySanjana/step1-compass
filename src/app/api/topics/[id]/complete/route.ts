import { NextResponse } from "next/server";
import { markTopicDone, todayISO } from "@/lib/schedule";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = Number(id);
  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }
  await markTopicDone(topicId, todayISO());
  return NextResponse.json({ ok: true });
}
