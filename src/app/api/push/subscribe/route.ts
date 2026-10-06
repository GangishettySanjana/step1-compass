import { NextResponse } from "next/server";
import { saveSubscription, type PushSubscriptionInput } from "@/lib/push";

export async function POST(req: Request) {
  const body = (await req.json()) as PushSubscriptionInput;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await saveSubscription(body);
  return NextResponse.json({ ok: true });
}
