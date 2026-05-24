import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { isAllowed } from "@/lib/rateLimiter";
import { signMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (!isAllowed(`mobile-login:${ip}`, 5, 15 * 60_000)) {
      return Response.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!["GROUND_OWNER", "GROUND_WORKER"].includes(user.role)) {
      return Response.json(
        { error: "Mobile app access is for facility owners and workers only." },
        { status: 403 }
      );
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await signMobileToken({
      id:                 user.id,
      name:               user.name,
      email:              user.email,
      role:               user.role,
      mustChangePassword: user.mustChangePassword,
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return Response.json({
      token,
      expiresAt,
      user: {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        role:               user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error("[POST /api/auth/mobile-login]", err);
    return Response.json({ error: "Login failed." }, { status: 500 });
  }
}
