import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { db, type DbTx } from "@/lib/db";
import { sendBookingOtpEmail } from "@/lib/email";

// Email OTP for pay-at-ground bookings. Every cash booking is confirmed with a fresh code:
// the player verifies, and the booking that follows spends that verification.
//
// Limits are counted in the database, not in memory, so they hold across server instances.

const CODE_TTL_MS     = 10 * 60_000;  // a code works for 10 minutes
const USE_WITHIN_MS   = 15 * 60_000;  // a verified code must be booked with inside this window
const RESEND_AFTER_MS = 60_000;       // one code per address per minute
const MAX_PER_HOUR    = 5;            // codes per address per hour
const MAX_PER_DAY     = 15;           // codes per account per day
const MAX_ATTEMPTS    = 5;            // wrong guesses before the code is burnt

export type EmailOtpResult =
  | { ok: true; verified?: true; expiresInSec?: number; resendInSec?: number; devCode?: string }
  | { ok: false; status: number; error: string; retryInSec?: number };

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
}

/** The verified-but-unspent code a booking for this address may use, if any */
function usableWhere(userId: string, email: string): Prisma.EmailVerificationWhereInput {
  return { userId, email, verifiedAt: { gte: new Date(Date.now() - USE_WITHIN_MS) }, usedAt: null };
}

export async function hasUsableEmailVerification(userId: string, email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  return !!(await db.emailVerification.findFirst({ where: usableWhere(userId, e), select: { id: true } }));
}

/** Spend the verification inside the booking transaction. False if another booking got there first. */
export async function consumeEmailVerification(tx: DbTx, userId: string, email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  const row = await tx.emailVerification.findFirst({ where: usableWhere(userId, e), orderBy: { verifiedAt: "desc" }, select: { id: true } });
  if (!row) return false;
  const { count } = await tx.emailVerification.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1;
}

export async function sendEmailOtp(userId: string, email: string): Promise<EmailOtpResult> {
  const e = normalizeEmail(email);
  if (!e) return { ok: false, status: 400, error: "Enter a valid email address." };

  const now  = Date.now();
  const last = await db.emailVerification.findFirst({ where: { email: e, verifiedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && now - last.createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, status: 429, error: `Please wait ${wait} seconds before asking for another code.`, retryInSec: wait };
  }
  const [perHour, perDay] = await Promise.all([
    db.emailVerification.count({ where: { email: e, createdAt: { gte: new Date(now - 60 * 60_000) } } }),
    db.emailVerification.count({ where: { userId, createdAt: { gte: new Date(now - 24 * 60 * 60_000) } } }),
  ]);
  if (perHour >= MAX_PER_HOUR || perDay >= MAX_PER_DAY) {
    return { ok: false, status: 429, error: "Too many codes requested. Please try again in an hour.", retryInSec: 3600 };
  }

  const code = String(randomInt(100000, 1000000));
  const row  = await db.emailVerification.create({
    data: { userId, email: e, codeHash: hashCode(e, code), expiresAt: new Date(now + CODE_TTL_MS) },
  });

  const sent = await sendBookingOtpEmail(e, code);
  if (!sent) {
    // Local testing without Resend keys: hand the code back instead of failing
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email-otp] DEV ONLY — code for ${e}: ${code}`);
      return { ok: true, expiresInSec: CODE_TTL_MS / 1000, resendInSec: RESEND_AFTER_MS / 1000, devCode: code };
    }
    await db.emailVerification.delete({ where: { id: row.id } });   // a code that never arrived shouldn't block a resend
    return { ok: false, status: 502, error: "We couldn't send the code. Check the email address and try again." };
  }
  return { ok: true, expiresInSec: CODE_TTL_MS / 1000, resendInSec: RESEND_AFTER_MS / 1000 };
}

export async function verifyEmailOtp(userId: string, email: string, code: string): Promise<EmailOtpResult> {
  const e = normalizeEmail(email);
  if (!e) return { ok: false, status: 400, error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(code ?? "")) return { ok: false, status: 400, error: "Enter the 6-digit code." };

  const row = await db.emailVerification.findFirst({
    where: { userId, email: e, verifiedAt: null }, orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, status: 400, error: "This code has expired. Ask for a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: "Too many wrong codes. Ask for a new one." };

  const a = Buffer.from(row.codeHash, "hex"), b = Buffer.from(hashCode(e, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.emailVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return left > 0
      ? { ok: false, status: 400, error: `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` }
      : { ok: false, status: 429, error: "Too many wrong codes. Ask for a new one." };
  }
  await db.emailVerification.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
  // A code to the account's own address also proves they own the account's email
  await db.user.updateMany({ where: { id: userId, email: { equals: e, mode: "insensitive" }, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  return { ok: true, verified: true };
}
