import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, signMobileToken } from "@/lib/mobile-auth";
import { nowToSecond } from "@/lib/google-auth";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword, signOutOtherDevices } = await req.json();

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Both current and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return Response.json({ error: "Password must contain at least one letter and one number." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { password: true, name: true, email: true, role: true } });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 12);

    // App builds that can store a replacement token ask for every other device to be signed out.
    // They get a fresh token issued after the cut-off; web sessions and older builds, which
    // can't swap their credentials, keep today's behaviour instead of being signed out themselves.
    if (signOutOtherDevices === true) {
      await db.user.update({ where: { id: session.user.id }, data: { password: hashed, sessionsValidAfter: nowToSecond() } });
      const token = await signMobileToken({ id: session.user.id, name: user.name ?? "", email: user.email ?? "", role: user.role });
      return Response.json({ message: "Password changed. Other devices have been signed out.", token });
    }

    await db.user.update({ where: { id: session.user.id }, data: { password: hashed } });
    return Response.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("[PUT /api/user/password]", err);
    return Response.json({ error: "Failed to change password." }, { status: 500 });
  }
}
