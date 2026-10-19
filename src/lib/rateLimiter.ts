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
  return (await recordHit(key, windowMs)) <= limit;
}

/** Count one hit and return the count in the current window (0 if the database is unavailable). */
export async function recordHit(key: string, windowMs: number): Promise<number> {
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
    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    console.error("[rateLimiter]", err);
    return 0;
  }
}

/** Has this key already reached `limit` in its current window? Doesn't count a hit. */
export async function isLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const row = await db.rateLimit.findUnique({ where: { key } });
    return !!row && row.windowStart.getTime() > Date.now() - windowMs && row.count >= limit;
  } catch (err) {
    console.error("[rateLimiter]", err);
    return false;
  }
}

const LOGIN_WINDOW = 15 * 60_000;

/**
 * Password-guessing guard. Only failed attempts count, so nobody can lock a player out by
 * hammering their email: failures are capped per account+IP (an attacker's failures don't block
 * the real player's own device) and, higher, per account across all IPs (stops spread-out guessing).
 */
export async function loginBlocked(email: string, ip: string): Promise<boolean> {
  return (await isLimited(`login-fail:${email}:${ip}`, 5, LOGIN_WINDOW))
      || (await isLimited(`login-fail:${email}`, 20, LOGIN_WINDOW))
      || !(await isAllowed(`login-ip:${ip}`, 30, LOGIN_WINDOW));
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  await Promise.all([recordHit(`login-fail:${email}:${ip}`, LOGIN_WINDOW), recordHit(`login-fail:${email}`, LOGIN_WINDOW)]);
}

/** Drop counters whose window ended long ago — called from a daily cron. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } });
  return count;
}
