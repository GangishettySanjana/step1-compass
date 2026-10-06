import webpush from "web-push";
import { ensureSchema, getSql } from "./db";

// Self-hosted web push (VAPID) — completely free, no third-party service.
// Generate a keypair once with `npx web-push generate-vapid-keys` and set
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (and expose the public one to the
// client as NEXT_PUBLIC_VAPID_PUBLIC_KEY).

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — generate a free pair with " +
        "`npx web-push generate-vapid-keys`"
    );
  }
  webpush.setVapidDetails("mailto:no-reply@step1compass.app", publicKey, privateKey);
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(sub: PushSubscriptionInput): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO NOTHING
  `;
}

export async function broadcastPush(payload: { title: string; body: string }): Promise<void> {
  configureWebPush();
  await ensureSchema();
  const sql = getSql();
  const subs = (await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`) as {
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
      } catch {
        // Expired/invalid subscriptions are expected over time (uninstalled
        // app, cleared data) — drop them rather than letting the whole
        // broadcast fail.
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
      }
    })
  );
}
