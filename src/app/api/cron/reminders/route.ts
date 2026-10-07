import { NextResponse } from "next/server";
import { connection } from "next/server";
import { sendReminderEmail } from "@/lib/email";
import { broadcastPush } from "@/lib/push";
import { getOrCreateToday, todayISO } from "@/lib/schedule";

// Trigger from a free external cron (e.g. cron-job.org, zero cost) hitting:
//   /api/cron/reminders?kind=morning&secret=YOUR_CRON_SECRET  (once, morning)
//   /api/cron/reminders?kind=evening&secret=YOUR_CRON_SECRET  (once, evening)
// Set CRON_SECRET and REMINDER_EMAILS (comma-separated) as env vars.

export async function GET(req: Request) {
  await connection();
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const kind = searchParams.get("kind");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (kind !== "morning" && kind !== "evening") {
    return NextResponse.json({ error: "kind must be 'morning' or 'evening'" }, { status: 400 });
  }

  const date = todayISO();
  const topics = await getOrCreateToday(date);
  const doneCount = topics.filter((t) => t.status === "done").length;

  if (kind === "evening" && doneCount > 0) {
    return NextResponse.json({ sent: false, reason: "Already made progress today" });
  }

  const names = topics.map((t) => t.name);
  const title = kind === "morning" ? "Today's 3 topics" : "Still time today";
  const body =
    kind === "morning"
      ? `Today: ${names.join(", ")}`
      : `Nothing checked off yet today. ${names.join(", ")} still waiting.`;

  const recipients = (process.env.REMINDER_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const results = { email: false, push: false };

  if (recipients.length > 0) {
    try {
      await sendReminderEmail({
        to: recipients,
        subject: title,
        html: `<p>${body}</p>`,
      });
      results.email = true;
    } catch {
      // Missing RESEND_API_KEY or send failure — don't block the push send.
    }
  }

  try {
    await broadcastPush({ title, body });
    results.push = true;
  } catch {
    // Missing VAPID keys or no subscribers yet — fine, email is the fallback.
  }

  return NextResponse.json({ sent: true, ...results });
}
