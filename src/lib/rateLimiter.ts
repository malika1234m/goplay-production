import { createHash } from "crypto";
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

const LOGIN_WINDOW = 15 * 60_000;

// The email is hashed so no crafted address can collide with another account's keys
const loginKeys = (email: string, ip: string) => {
  const acct = createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 32);
  return { acctIp: `login-fail-acctip:${acct}|${ip}`, acct: `login-fail-acct:${acct}`, ip: `login-ip:${ip}` };
};

/**
 * Password-guessing guard. Reserve an attempt *before* checking the password — atomically, so
 * parallel guesses can't all slip past the limit — and hand it back with releaseLoginAttempt()
 * when the login succeeds. Net effect: only failures count, so nobody can lock a player out by
 * hammering their email. Failures are capped per account+IP (an attacker's failures don't block
 * the real player's own device) and, higher, per account from any IP (stops spread-out guessing).
 * Returns false when the attempt must be refused.
 */
export async function reserveLoginAttempt(email: string, ip: string): Promise<boolean> {
  const k = loginKeys(email, ip);
  const [ipCount, acctIp, acct] = await Promise.all([
    recordHit(k.ip, LOGIN_WINDOW), recordHit(k.acctIp, LOGIN_WINDOW), recordHit(k.acct, LOGIN_WINDOW),
  ]);
  if (ipCount <= 30 && acctIp <= 5 && acct <= 20) return true;
  // Refused before any password check — hand the slot back, so a burst of refused requests
  // can't push the account-wide count up and lock the real player out everywhere
  await releaseLoginAttempt(email, ip);
  return false;
}

/** A successful login gives its reserved attempt back. */
export async function releaseLoginAttempt(email: string, ip: string): Promise<void> {
  const k = loginKeys(email, ip);
  try {
    await db.$executeRaw`UPDATE "RateLimit" SET "count" = GREATEST("count" - 1, 0) WHERE "key" IN (${k.acctIp}, ${k.acct})`;
  } catch (err) {
    console.error("[rateLimiter]", err);
  }
}

/** Drop counters whose window ended long ago — called from a daily cron. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } });
  return count;
}
