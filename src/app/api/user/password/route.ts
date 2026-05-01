import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Both current and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { password: true } });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: session.user.id }, data: { password: hashed } });

    return Response.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("[PUT /api/user/password]", err);
    return Response.json({ error: "Failed to change password." }, { status: 500 });
  }
}
