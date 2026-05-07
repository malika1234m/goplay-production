import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return Response.json({ error: "Token and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const record = await db.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!record) {
      return Response.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }
    if (record.usedAt) {
      return Response.json({ error: "This reset link has already been used." }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return Response.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return Response.json({ message: "Password reset successfully. You can now sign in." });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
