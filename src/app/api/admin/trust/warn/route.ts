import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { createNotification } from "@/lib/notify";
import { sendAccountWarningEmail } from "@/lib/email";

// POST /api/admin/trust/warn — { userId, message } — a formal warning by email and in the app
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { userId, message } = await req.json().catch(() => ({}));
    const text = String(message ?? "").trim();
    if (text.length < 10 || text.length > 1000) return Response.json({ error: "Write a message of 10–1000 characters." }, { status: 400 });
    const user = await db.user.findFirst({ where: { id: String(userId ?? ""), role: "USER" }, select: { id: true, name: true, email: true } });
    if (!user) return Response.json({ error: "Player not found." }, { status: 404 });

    await createNotification({ userId: user.id, title: "A note from GoPlay", message: text, type: "warning" });
    void sendAccountWarningEmail({ to: user.email, name: user.name, message: text });
    return Response.json({ message: "Warning sent." });
  } catch (err) {
    console.error("[POST /api/admin/trust/warn]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
