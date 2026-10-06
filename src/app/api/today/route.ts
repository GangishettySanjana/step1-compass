import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getOrCreateToday, phaseForDate, todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();
  const date = todayISO();
  const topics = await getOrCreateToday(date);
  return NextResponse.json({ date, phase: phaseForDate(date), topics });
}
