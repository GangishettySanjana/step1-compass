import { Resend } from "resend";

// Resend free tier: 100 emails/day, 3,000/month, no credit card. Needs
// RESEND_API_KEY and a verified FROM address (Resend's onboarding domain
// works for free without owning a custom domain).

export async function sendReminderEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Add a free key from resend.com");
  }
  const resend = new Resend(apiKey);
  const from = process.env.REMINDER_FROM_EMAIL || "Step 1 Compass <onboarding@resend.dev>";

  await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
