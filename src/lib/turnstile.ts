// Cloudflare Turnstile — proves a website form was filled in by a person, not a script.
// The mobile apps can't show the widget; they identify themselves with APP_HEADER and get
// stricter rate limits instead (a bot can fake that header, so the limits are the backstop).

export const APP_HEADER = "x-goplay-app";

let warned = false;

/** True for requests from the GoPlay mobile apps rather than the website. */
export function isAppRequest(req: { headers: { get(name: string): string | null } }): boolean {
  return !!req.headers.get(APP_HEADER);
}

/**
 * Check a Turnstile token with Cloudflare. Without TURNSTILE_SECRET_KEY the check is skipped in
 * development and refused on the live site (next.config.ts also stops a production build without it).
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    const live = process.env.VERCEL_ENV === "production";
    if (!warned) {
      console[live ? "error" : "warn"](`[turnstile] TURNSTILE_SECRET_KEY not set — ${live ? "refusing every check" : "bot check skipped"}`);
      warned = true;
    }
    return !live;
  }
  if (typeof token !== "string" || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res  = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body, signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("[turnstile] rejected", data["error-codes"]);
    return !!data.success;
  } catch (err) {
    // Cloudflare unreachable — don't lock people out; the rate limits still apply
    console.error("[turnstile] verify failed", err);
    return true;
  }
}
