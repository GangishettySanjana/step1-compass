import { NextResponse } from "next/server";
import { recordNbmeScore } from "@/lib/schedule";

interface NbmeBody {
  id: number;
  score: number | null;
  examDate: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as NbmeBody;
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await recordNbmeScore(body.id, body.score ?? null, body.examDate ?? null);
  return NextResponse.json({ ok: true });
}
