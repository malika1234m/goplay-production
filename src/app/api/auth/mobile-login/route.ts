import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getClientIp, reserveLoginAttempt } from "@/lib/rateLimiter";
import { signMobileToken } from "@/lib/mobile-auth";
import { APP_HEADER } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const ip      = getClientIp(req);
    const account = String(email).toLowerCase().trim();
    const attempt = await reserveLoginAttempt(account, ip);
    if (!attempt.ok) {
      return Response.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Case-insensitive, like the rate limit and Google sign-in: "Ana@x.lk" and "ana@x.lk" are one account
    const user = await db.user.findFirst({ where: { email: { equals: account, mode: "insensitive" } } });

    // Always run bcrypt even when user not found — prevents email enumeration via timing
    const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    const match = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    // Only after the right password: say the account is blocked rather than "wrong password"
    if (user && match && !user.isActive) {
      return Response.json(
        { error: "This account has been blocked. Check your email for details, or contact official.goplay.support@gmail.com." },
        { status: 403 },
      );
    }
    if (!user || !match) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!["USER", "GROUND_OWNER", "GROUND_WORKER"].includes(user.role)) {
      return Response.json(
        { error: "This account cannot sign in from the mobile app." },
        { status: 403 }
      );
    }

    // The partner app is for owners and workers: a player gets told why, and an applicant sees where
    // their application stands instead of an empty dashboard
    if (req.headers.get(APP_HEADER) === "partner" && user.role === "USER") {
      await attempt.release();   // the password was right, so this doesn't count towards the limit
      const application = await db.providerApplication.findFirst({
        where:   { userId: user.id },
        orderBy: { createdAt: "desc" },
        select:  { status: true },
      });
      if (application?.status === "PENDING") {
        return Response.json(
          { error: "Your ground owner application is still being reviewed.", code: "APPLICATION_PENDING" },
          { status: 403 },
        );
      }
      if (application?.status === "REJECTED") {
        return Response.json(
          { error: "Your ground owner application was not approved.", code: "APPLICATION_REJECTED" },
          { status: 403 },
        );
      }
      return Response.json(
        { error: "This is a player account. Use the GoPlay app to book grounds, or apply to list your ground.", code: "PLAYER_ACCOUNT" },
        { status: 403 },
      );
    }

    await attempt.release();   // success doesn't count towards the limit

    const token = await signMobileToken({
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return Response.json({
      token,
      expiresAt,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    });
  } catch (err) {
    console.error("[POST /api/auth/mobile-login]", err);
    return Response.json({ error: "Login failed." }, { status: 500 });
  }
}
