import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, signMobileToken } from "@/lib/mobile-auth";
import { nowToSecond } from "@/lib/google-auth";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["ADMIN", "GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { currentPassword, newPassword, confirmPassword, signOutOtherDevices } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json({ error: "All fields are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      return Response.json({ error: "Password must contain at least one letter." }, { status: 400 });
    }
    if (!/[0-9]/.test(newPassword)) {
      return Response.json({ error: "Password must contain at least one number." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return Response.json({ error: "New passwords do not match." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { password: true, mustChangePassword: true, name: true, email: true, role: true },
    });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 });

    if (newPassword === currentPassword) {
      return Response.json({ error: "New password must be different from your current password." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // App builds that can store a replacement token ask for every other device to be signed out
    // (see /api/user/password); everyone else keeps today's behaviour
    const signOutOthers = signOutOtherDevices === true;
    await db.user.update({
      where: { id: session.user.id },
      data:  { password: hashed, mustChangePassword: false, ...(signOutOthers ? { sessionsValidAfter: nowToSecond() } : {}) },
    });
    if (signOutOthers) {
      const token = await signMobileToken({ id: session.user.id, name: user.name, email: user.email, role: user.role });
      return Response.json({ message: "Password updated. Other devices have been signed out.", token });
    }

    return Response.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/force-change-password]", err);
    return Response.json({ error: "Failed to update password." }, { status: 500 });
  }
}
