import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

// "Continue with Google" for the website (NextAuth) and the player app (ID token).
// A Google login is matched to a GoPlay account by its verified email; a new email
// becomes a player account. Owners and workers still join through their own flows.

const GOOGLE_CERTS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleProfile { email: string; name: string; picture?: string }

/** Client IDs whose ID tokens we accept: the web client (the app requests tokens for it too). */
function audiences(): string[] {
  return [process.env.AUTH_GOOGLE_ID, ...(process.env.GOOGLE_EXTRA_CLIENT_IDS ?? "").split(",")]
    .map((s) => s?.trim()).filter((s): s is string => !!s);
}

/** Check an ID token from the app's Google sign-in. Null if it isn't a genuine, verified Google login. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  const aud = audiences();
  if (!aud.length || !idToken) return null;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_CERTS, {
      issuer:   ["https://accounts.google.com", "accounts.google.com"],
      audience: aud,
    });
    if (payload.email_verified !== true || typeof payload.email !== "string") return null;
    return {
      email:   payload.email,
      name:    typeof payload.name === "string" && payload.name.trim() ? payload.name : payload.email.split("@")[0],
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch (err) {
    console.warn("[google-auth] ID token rejected:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Whole seconds, so a token issued in the same second still counts as "after". */
export const nowToSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

/**
 * The GoPlay account for this Google login — created as a player the first time.
 *
 * Sign-up never proved email ownership, so someone could have registered this address first.
 * Google has now proven who owns it: if the account was never verified, its password is replaced
 * and every existing session ended, so a pre-registered impostor loses access. The real owner
 * keeps Google sign-in, or sets a new password with "Forgot password".
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const email = profile.email.toLowerCase().trim();
  const existing = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing?.emailVerifiedAt) return existing;
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data:  {
        password:           await bcrypt.hash(randomUUID(), 10),
        emailVerifiedAt:    new Date(),
        sessionsValidAfter: nowToSecond(),
        pushToken:          null,
      },
    });
  }

  const user = await db.user.create({
    data: {
      name:     profile.name.slice(0, 50),
      email,
      // Unusable random password — they sign in with Google, or set one via "Forgot password"
      password: await bcrypt.hash(randomUUID(), 10),
      avatar:   profile.picture ?? null,
      role:     "USER",
      emailVerifiedAt: new Date(),
    },
  });
  void sendWelcomeEmail(user.email, user.name ?? "there");
  return user;
}
