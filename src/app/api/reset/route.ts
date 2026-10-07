import { NextResponse } from "next/server";
import { connection } from "next/server";
import { resetAllProgress } from "@/lib/schedule";

export async function POST() {
  await connection();
  await resetAllProgress();
  return NextResponse.json({ ok: true });
}
