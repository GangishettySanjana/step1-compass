import { neon } from "@neondatabase/serverless";

// Vercel's Neon Postgres integration (Storage tab, free tier) injects
// DATABASE_URL automatically. POSTGRES_URL is the older Vercel Postgres name,
// kept as a fallback so either integration works without code changes.
function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database connection string found. Add a free Postgres database " +
        "from the Vercel project's Storage tab (Neon) — it sets DATABASE_URL automatically. " +
        "For local dev, copy that same connection string into .env.local as DATABASE_URL."
    );
  }
  return url;
}

export function getSql() {
  return neon(connectionString());
}

let schemaReady: Promise<void> | null = null;

// Idempotent — safe to call on every cold start. Only the first call per
// deployment actually creates anything.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS topics (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          system TEXT NOT NULL,
          system_order INT NOT NULL,
          difficulty TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          assigned_date DATE,
          deferred_until DATE,
          done_date DATE,
          weak BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Table already existed in production before `notes` was added —
      // CREATE TABLE IF NOT EXISTS above won't retroactively add it.
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS notes TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS topics_status_idx ON topics (status)`;
      await sql`CREATE INDEX IF NOT EXISTS topics_assigned_date_idx ON topics (assigned_date)`;

      await sql`
        CREATE TABLE IF NOT EXISTS nbme_results (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          planned_month TEXT NOT NULL,
          exam_date DATE,
          score INT,
          sort_order INT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS quiz_results (
          id SERIAL PRIMARY KEY,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          score INT NOT NULL,
          total INT NOT NULL,
          topics_covered TEXT[] NOT NULL,
          weak_topics TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS intention_cache (
          for_date DATE PRIMARY KEY,
          text TEXT NOT NULL
        )
      `;
    })();
  }
  return schemaReady;
}

export async function getSetting(key: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
  return rows.length ? (rows[0] as { value: string }).value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}
