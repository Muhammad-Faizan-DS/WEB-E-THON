import { sql } from "drizzle-orm";
import journal from "../../../../db/migrations/meta/_journal.json";
import { database } from "@/server/database";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe for deployments: database round trip, applied vs expected migrations,
 * and which required settings are present (names only, never values). 200 when ready, 503 otherwise.
 */
export async function GET() {
  const started = Date.now();
  const env = Object.fromEntries(["DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "CRON_SECRET"].map((name) => [name, Boolean(process.env[name])]));
  const expected = journal.entries.length;
  let databaseCheck: { ok: boolean; latencyMs?: number; error?: string } = { ok: false };
  let applied: number | null = null;
  try {
    const before = Date.now();
    await database().execute(sql`select 1`);
    databaseCheck = { ok: true, latencyMs: Date.now() - before };
    const { rows } = await database().execute(sql`select count(*)::int as total from drizzle.__drizzle_migrations`);
    applied = Number((rows[0] as { total: number }).total);
  } catch (error) {
    databaseCheck = { ok: false, error: error instanceof Error ? error.name : "DatabaseError" };
  }
  const ready = databaseCheck.ok && applied === expected && env.DATABASE_URL && env.AUTH_SECRET;
  return Response.json({
    status: ready ? "ok" : "degraded",
    checks: { database: databaseCheck, migrations: { applied, expected, ok: applied === expected }, env },
    deployment: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, environment: process.env.VERCEL_ENV ?? "local" },
    serverNow: new Date().toISOString(), tookMs: Date.now() - started,
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
