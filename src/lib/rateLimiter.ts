/**
 * In-memory sliding-window rate limiter.
 * Not suitable for multi-instance deployments — use Redis there.
 * Good enough for single-instance production servers.
 */

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();

// Prune entries older than 2x the window to avoid unbounded memory growth
function prune(key: string, windowMs: number) {
  const entry = store.get(key);
  if (!entry) return;
  const cutoff = Date.now() - windowMs * 2;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length === 0) store.delete(key);
}

/** Extract the best-effort client IP from a Next.js request. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key — typically `${route}:${ip}`
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function isAllowed(key: string, limit: number, windowMs: number): boolean {
  prune(key, windowMs);

  const now    = Date.now();
  const cutoff = now - windowMs;
  const entry  = store.get(key) ?? { timestamps: [] };

  const recent = entry.timestamps.filter((t) => t > cutoff);

  if (recent.length >= limit) return false;

  recent.push(now);
  store.set(key, { timestamps: recent });
  return true;
}
