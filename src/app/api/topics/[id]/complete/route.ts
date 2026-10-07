import { NextResponse } from "next/server";
import { markTopicDone, todayISO } from "@/lib/schedule";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = Number(id);
  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }
  let note: string | null | undefined;
  try {
    const body = await req.json();
    note = typeof body?.note === "string" ? body.note : undefined;
  } catch {
    note = undefined;
  }
  await markTopicDone(topicId, todayISO(), note);
  return NextResponse.json({ ok: true });
}
