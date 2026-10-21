import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

// DELETE /api/ground-owner/workers/invites/[id] — the owner withdraws an invitation nobody has answered
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;

    const { count } = await db.workerInvite.updateMany({
      where: { id, status: "PENDING", facility: { owner: { userId: session.user.id } } },
      data:  { status: "CANCELLED", respondedAt: new Date() },
    });
    if (count === 0) return Response.json({ error: "This invitation was already answered or withdrawn." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/workers/invites/[id]]", err);
    return Response.json({ error: "Failed to withdraw the invitation." }, { status: 500 });
  }
}
