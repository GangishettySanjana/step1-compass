import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getDailyTopicCountSetting, getTargetCount, phaseForDate, setDailyTopicCount, todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();
  const date = todayISO();
  const override = await getDailyTopicCountSetting();
  const effective = await getTargetCount(phaseForDate(date));
  return NextResponse.json({ override, effective });
}

export async function POST(req: Request) {
  const body = await req.json();
  const count = Number(body?.count);
  if (!Number.isInteger(count)) {
    return NextResponse.json({ error: "count must be an integer" }, { status: 400 });
  }
  const clamped = await setDailyTopicCount(count);
  return NextResponse.json({ ok: true, count: clamped });
}
