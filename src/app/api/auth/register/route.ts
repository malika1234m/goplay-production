import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";
import { isAllowed, getClientIp } from "@/lib/rateLimiter";
import { isAppRequest, verifyTurnstile } from "@/lib/turnstile";
import { isBlocked } from "@/lib/trust";

export async function POST(req: NextRequest) {
  try {
    // Per IP — loose, because mobile carriers put many players behind one address. The apps
    // can't show the bot check, so their requests get a tighter limit.
    const ip  = getClientIp(req);
    const app = isAppRequest(req);
    if (!(await isAllowed(`register:${ip}`, 10, 60 * 60_000)) || (app && !(await isAllowed(`register-app:${ip}`, 5, 60 * 60_000)))) {
      return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    }

    const { name, email, password, phone, turnstileToken } = await req.json();
    if (!app && !(await verifyTurnstile(turnstileToken, ip))) {
      return Response.json({ error: "Please complete the security check and try again.", code: "CAPTCHA_FAILED" }, { status: 400 });
    }

    if (!name?.trim() || !email?.trim() || !password) {
      return Response.json({ error: "Name, email and password are required." }, { status: 400 });
    }
    if (name.trim().length < 2 || name.trim().length > 50) {
      return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return Response.json({ error: "Password must contain at least one letter and one number." }, { status: 400 });
    }
    if (phone?.trim()) {
      const cleaned = phone.replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
        return Response.json({ error: "Enter a valid Sri Lankan mobile number." }, { status: 400 });
      }
    }

    // Blocked people can't come back on the same email or phone
    if (await isBlocked({ email, phone })) {
      return Response.json({ error: "This email or phone number can't be used to create a GoPlay account. Contact support if you think this is a mistake." }, { status: 403 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        phone: phone || null,
        role: "USER",
      },
    });

    void sendWelcomeEmail(user.email, user.name ?? "there");
    return Response.json({ message: "Account created successfully.", userId: user.id }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
