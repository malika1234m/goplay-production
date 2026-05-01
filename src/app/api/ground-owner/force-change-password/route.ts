import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json({ error: "All fields are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return Response.json({ error: "New passwords do not match." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { password: true, mustChangePassword: true },
    });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 });

    if (newPassword === currentPassword) {
      return Response.json({ error: "New password must be different from your current password." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data:  { password: hashed, mustChangePassword: false },
    });

    return Response.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/force-change-password]", err);
    return Response.json({ error: "Failed to update password." }, { status: 500 });
  }
}
