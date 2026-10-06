import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getProgressStats, todayISO } from "@/lib/schedule";

export async function GET() {
  await connection();
  const stats = await getProgressStats(todayISO());
  return NextResponse.json(stats);
}
