import { db } from "@/lib/db";

/**
 * Rate limiter backed by Postgres, so the limit holds across all server instances.
 * One row per key, counted in fixed windows by a single atomic upsert.
 * If the database call fails the request is let through — a limiter outage must not lock
 * everyone out of logging in.
 */

/** Best-effort client IP. Vercel sets x-vercel-forwarded-for itself, so it can't be spoofed there. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key — typically `${route}:${ip}` or `${route}:${userId}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function isAllowed(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count"       = CASE WHEN "RateLimit"."windowStart" < now() - ${windowMs} * interval '1 millisecond'
                             THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - ${windowMs} * interval '1 millisecond'
                             THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING "count"`;
    return Number(rows[0]?.count ?? 0) <= limit;
  } catch (err) {
    console.error("[rateLimiter]", err);
    return true;
  }
}

/** Drop counters whose window ended long ago — called from a daily cron. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } });
  return count;
}
