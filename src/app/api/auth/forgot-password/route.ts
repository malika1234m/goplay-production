import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    // Always return the same message — never reveal whether an account exists
    const genericOk = Response.json(
      { message: "If that email is registered, a reset link has been sent." },
      { status: 200 }
    );

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    });
    if (!user) return genericOk;

    // Invalidate any existing unused tokens for this user
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Generate a secure random token; store its SHA-256 hash
    const rawToken    = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await db.passwordResetToken.create({
      data: {
        userId:    user.id,
        token:     hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "https://goplay.lk";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return genericOk;
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
