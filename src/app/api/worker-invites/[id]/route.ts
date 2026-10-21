import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notify";

// POST /api/worker-invites/[id] — { action: "accept" | "decline" } — the invited player answers.
// Accepting turns their account into a worker account for that ground; only they can do that.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    const { id } = await params;
    const { action } = await req.json().catch(() => ({}));
    if (action !== "accept" && action !== "decline") return Response.json({ error: 'action must be "accept" or "decline".' }, { status: 400 });

    const invite = await db.workerInvite.findFirst({
      where:   { id, userId: session.user.id },
      include: { facility: { select: { id: true, name: true, status: true, owner: { select: { userId: true } } } } },
    });
    if (!invite) return Response.json({ error: "Invitation not found." }, { status: 404 });
    if (invite.status !== "PENDING") return Response.json({ error: "This invitation was already answered or withdrawn." }, { status: 409 });

    if (action === "decline") {
      const { count } = await db.workerInvite.updateMany({ where: { id, status: "PENDING" }, data: { status: "DECLINED", respondedAt: new Date() } });
      if (count === 0) return Response.json({ error: "This invitation was already answered or withdrawn." }, { status: 409 });
      await createNotification({
        userId: invite.facility.owner.userId, title: "Worker invitation declined",
        message: `${session.user.name ?? "The player"} declined your invitation to work at ${invite.facility.name}.`, type: "info",
      });
      return Response.json({ ok: true, message: "Invitation declined." });
    }

    if (invite.facility.status !== "ACTIVE") return Response.json({ error: "This ground is no longer on GoPlay." }, { status: 409 });

    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.workerInvite.updateMany({ where: { id, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      if (claimed.count === 0) return "answered" as const;
      // Only a plain, active player account can become a worker, and only for one ground
      const promoted = await tx.user.updateMany({ where: { id: session.user.id, role: "USER", isActive: true }, data: { role: "GROUND_WORKER" } });
      if (promoted.count === 0) throw new Error("not-a-player");
      if (await tx.facilityWorker.findUnique({ where: { userId: session.user.id } })) throw new Error("already-worker");
      await tx.facilityWorker.create({ data: { facilityId: invite.facilityId, userId: session.user.id, addedBy: invite.invitedBy } });
      // Any other invitations no longer apply
      await tx.workerInvite.updateMany({ where: { userId: session.user.id, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: new Date() } });
      return "accepted" as const;
    }).catch((e: Error) => (e.message === "not-a-player" || e.message === "already-worker" ? e.message : Promise.reject(e)));

    if (result === "answered") return Response.json({ error: "This invitation was already answered or withdrawn." }, { status: 409 });
    if (result === "not-a-player" || result === "already-worker") {
      return Response.json({ error: "Only a player account that isn't already a worker can accept this invitation." }, { status: 409 });
    }

    await createNotification({
      userId: invite.facility.owner.userId, title: "New worker joined",
      message: `${session.user.name ?? "Your invited worker"} accepted your invitation and is now a worker at ${invite.facility.name}.`, type: "success",
    });
    return Response.json({
      ok: true,
      message: `You're now a worker at ${invite.facility.name}. Use the GoPlay Owner app or the website's worker dashboard to manage its bookings.`,
    });
  } catch (err) {
    console.error("[POST /api/worker-invites/[id]]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
