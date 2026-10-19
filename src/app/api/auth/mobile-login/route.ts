import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getClientIp, reserveLoginAttempt } from "@/lib/rateLimiter";
import { signMobileToken } from "@/lib/mobile-auth";

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

    const user = await db.user.findUnique({ where: { email } });

    // Always run bcrypt even when user not found — prevents email enumeration via timing
    const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    const match = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !user.isActive || !match) {
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
