# Step 1 Compass

A shared daily study companion for USMLE Step 1 prep — built for 3 people (the
student + two collaborators) to view and edit the same live data on one link.

## Stack (all free tiers)

- **Next.js 16** (App Router, Cache Components) — hosted on **Vercel** (Hobby, free)
- **Postgres** via Vercel's **Neon** integration (Storage tab, free tier)
- **OpenRouter** free-tier model for the daily intention banner + weekly quiz
- **Resend** free tier for reminder emails (100/day)
- Self-hosted **web push** (VAPID keys) for browser notifications — no third-party push service
- A free external cron (e.g. [cron-job.org](https://cron-job.org)) to trigger daily reminders

## One-time setup after deploying to Vercel

1. **Import this repo into Vercel** (vercel.com → Add New → Project → pick this GitHub repo). Deploy with defaults.
2. **Add a database**: in the Vercel project, go to Storage → Create Database → Postgres (Neon) → Connect to this project. This sets `DATABASE_URL` automatically — no code changes needed. The app creates its own tables and seeds the topic bank on first load.
3. **Add env vars** (Project Settings → Environment Variables) — see `.env.example` for the full list:
   - `OPENROUTER_API_KEY` — free key from [openrouter.ai/keys](https://openrouter.ai/keys)
   - `RESEND_API_KEY` — free key from [resend.com](https://resend.com)
   - `REMINDER_EMAILS` — comma-separated list of the 3 people's emails
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — generate once with `npx web-push generate-vapid-keys`
   - `CRON_SECRET` — any random string you make up
4. **Redeploy** after adding env vars (Vercel → Deployments → Redeploy).
5. **Set up the free reminder cron**: at [cron-job.org](https://cron-job.org) (free, no card), create two jobs hitting:
   - `https://<your-app>.vercel.app/api/cron/reminders?kind=morning&secret=<CRON_SECRET>` — once every morning
   - `https://<your-app>.vercel.app/api/cron/reminders?kind=evening&secret=<CRON_SECRET>` — once every evening
6. **Install as an app**: open the Vercel URL on a phone, use "Add to Home Screen" (iOS Safari) or the install prompt (Android Chrome) for a real app icon and push notifications.

## What's scheduled where

- The topic bank (17 systems, ~170 topics) is seeded automatically on first load — see `src/lib/seed-data.ts`.
- **Oct 7 – Nov 30**: first pass, 3 topics/day, system-by-system, difficulty-balanced.
- **Dec 1 onward**: revision mode, 4 topics/day, cross-system, weak topics first.
- NBME 33/32/31 (Dec) and NBME 30/29/28 (Jan) are tracked as editable milestones, not daily tasks.

All scheduling logic lives in `src/lib/schedule.ts` if dates or pacing ever need to change.

## Local development

```bash
npm install
npm run dev
```

You'll need a `.env.local` with at least `DATABASE_URL` pointing at a Postgres
instance (the same one from Vercel's Storage tab works fine for local dev too
— copy its connection string).
