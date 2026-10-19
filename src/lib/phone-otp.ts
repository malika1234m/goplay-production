import { createHash, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { sendSMS } from "@/lib/sms";

// Phone OTP for pay-at-ground bookings. A player proves they own a number once;
// later bookings on the same number skip the code.
//
// Limits are counted in the database, not in memory, so they hold across server instances
// (and stop SMS-pumping fraud from running up the Notify.lk bill).

const CODE_TTL_MS     = 5 * 60_000;   // a code works for 5 minutes
const RESEND_AFTER_MS = 60_000;       // one code per number per minute
const MAX_PER_HOUR    = 5;            // codes per number per hour
const MAX_PER_DAY     = 10;           // codes per account per day
const MAX_ATTEMPTS    = 5;            // wrong guesses before the code is burnt

export type OtpResult =
  | { ok: true; verified?: true; expiresInSec?: number; resendInSec?: number; devCode?: string }
  | { ok: false; status: number; error: string; retryInSec?: number };

/** Sri Lankan mobile numbers only, as 07XXXXXXXX. Landlines can't receive SMS. */
export function normalizeLkMobile(phone: string | null | undefined): string | null {
  const c = (phone ?? "").replace(/[\s\-().]/g, "");
  const local = c.startsWith("+94") ? "0" + c.slice(3) : c.startsWith("94") && c.length === 11 ? "0" + c.slice(2) : c.length === 9 ? "0" + c : c;
  return /^07\d{8}$/.test(local) ? local : null;
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
}

export async function isPhoneVerified(userId: string, phone: string): Promise<boolean> {
  const local = normalizeLkMobile(phone);
  if (!local) return false;
  const row = await db.phoneVerification.findFirst({ where: { userId, phone: local, verifiedAt: { not: null } }, select: { id: true } });
  return !!row;
}

export async function sendPhoneOtp(userId: string, phone: string): Promise<OtpResult> {
  const local = normalizeLkMobile(phone);
  if (!local) return { ok: false, status: 400, error: "Enter a Sri Lankan mobile number (07X XXX XXXX)." };
  if (await isPhoneVerified(userId, local)) return { ok: true, verified: true };

  const now  = Date.now();
  const last = await db.phoneVerification.findFirst({ where: { phone: local, verifiedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && now - last.createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, status: 429, error: `Please wait ${wait} seconds before asking for another code.`, retryInSec: wait };
  }
  const [perHour, perDay] = await Promise.all([
    db.phoneVerification.count({ where: { phone: local, createdAt: { gte: new Date(now - 60 * 60_000) } } }),
    db.phoneVerification.count({ where: { userId, createdAt: { gte: new Date(now - 24 * 60 * 60_000) } } }),
  ]);
  if (perHour >= MAX_PER_HOUR || perDay >= MAX_PER_DAY) {
    return { ok: false, status: 429, error: "Too many codes requested. Please try again in an hour.", retryInSec: 3600 };
  }

  const code = String(randomInt(100000, 1000000));
  const row  = await db.phoneVerification.create({
    data: { userId, phone: local, codeHash: hashCode(local, code), expiresAt: new Date(now + CODE_TTL_MS) },
  });

  const sent = await sendSMS(local, `${code} is your GoPlay verification code. It expires in 5 minutes. Never share this code with anyone.`);
  if (!sent) {
    // Local testing without Notify.lk keys: hand the code back instead of failing
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[phone-otp] DEV ONLY — code for ${local}: ${code}`);
      return { ok: true, expiresInSec: CODE_TTL_MS / 1000, resendInSec: RESEND_AFTER_MS / 1000, devCode: code };
    }
    await db.phoneVerification.delete({ where: { id: row.id } });   // a code that never arrived shouldn't block a resend
    return { ok: false, status: 502, error: "We couldn't send the code. Check the number and try again." };
  }
  return { ok: true, expiresInSec: CODE_TTL_MS / 1000, resendInSec: RESEND_AFTER_MS / 1000 };
}

export async function verifyPhoneOtp(userId: string, phone: string, code: string): Promise<OtpResult> {
  const local = normalizeLkMobile(phone);
  if (!local) return { ok: false, status: 400, error: "Enter a Sri Lankan mobile number (07X XXX XXXX)." };
  if (await isPhoneVerified(userId, local)) return { ok: true, verified: true };
  if (!/^\d{6}$/.test(code ?? "")) return { ok: false, status: 400, error: "Enter the 6-digit code." };

  const row = await db.phoneVerification.findFirst({
    where: { userId, phone: local, verifiedAt: null }, orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, status: 400, error: "This code has expired. Ask for a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, status: 429, error: "Too many wrong codes. Ask for a new one." };

  const a = Buffer.from(row.codeHash, "hex"), b = Buffer.from(hashCode(local, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.phoneVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return left > 0
      ? { ok: false, status: 400, error: `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` }
      : { ok: false, status: 429, error: "Too many wrong codes. Ask for a new one." };
  }
  await db.phoneVerification.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
  return { ok: true, verified: true };
}
