import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createNotification } from "@/lib/notify";
import { sendWorkerInviteEmail } from "@/lib/email";
import { isBlocked } from "@/lib/trust";

async function getOwnedFacilityIds(userId: string) {
  const profile = await db.groundOwnerProfile.findUnique({
    where: { userId },
    include: { facilities: { select: { id: true } } },
  });
  return profile?.facilities.map((f) => f.id) ?? [];
}

// GET /api/ground-owner/workers?facilityId=X
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");
    if (!facilityId) return Response.json({ error: "facilityId required" }, { status: 400 });

    const ownedIds = await getOwnedFacilityIds(session.user.id);
    if (!ownedIds.includes(facilityId)) return Response.json({ error: "Not found" }, { status: 404 });

    const workers = await db.facilityWorker.findMany({
      where: { facilityId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    const invites = await db.workerInvite.findMany({
      where:   { facilityId, status: "PENDING" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      // Invitations sent to existing accounts that haven't answered yet
      invites: invites.map((i) => ({ id: i.id, name: i.user.name, email: i.user.email, sentAt: i.createdAt })),
      workers: workers.map((w) => ({
        id:       w.id,
        userId:   w.userId,
        name:     w.user.name,
        email:    w.user.email,
        joinedAt: w.createdAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/workers]", err);
    return Response.json({ error: "Failed to fetch workers." }, { status: 500 });
  }
}

// POST /api/ground-owner/workers  { facilityId, email, name? }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { facilityId, email, name } = await req.json();
    if (!facilityId || !email) {
      return Response.json({ error: "facilityId and email are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (name) {
      const n = name.trim();
      if (n.length < 2)  return Response.json({ error: "Worker name must be at least 2 characters." }, { status: 400 });
      if (n.length > 50) return Response.json({ error: "Worker name must be under 50 characters." }, { status: 400 });
    }

    const ownedIds = await getOwnedFacilityIds(session.user.id);
    if (!ownedIds.includes(facilityId)) return Response.json({ error: "Not found" }, { status: 404 });

    const normEmail = email.trim().toLowerCase();
    const facility  = await db.sportsFacility.findUnique({ where: { id: facilityId }, select: { name: true, status: true } });
    if (facility?.status !== "ACTIVE") return Response.json({ error: "Workers can only be added to a ground that's live on GoPlay." }, { status: 409 });

    const existing = await db.user.findFirst({ where: { email: { equals: normEmail, mode: "insensitive" } } });

    // ── An existing account is never changed by the owner: the person gets an invitation ──
    if (existing) {
      if (existing.role === "ADMIN" || existing.role === "GROUND_OWNER") {
        return Response.json({ error: "This account cannot be assigned as a worker." }, { status: 409 });
      }
      const assigned = await db.facilityWorker.findUnique({ where: { userId: existing.id } });
      if (assigned) {
        return Response.json({
          error: assigned.facilityId === facilityId
            ? "This person is already a worker at this facility."
            : "This person is already assigned to another facility.",
        }, { status: 409 });
      }
      if (!existing.isActive) return Response.json({ error: "This account can't be invited." }, { status: 409 });

      const pending = await db.workerInvite.findFirst({ where: { userId: existing.id, facilityId, status: "PENDING" }, select: { id: true } });
      const invite  = pending ?? await db.workerInvite.create({ data: { facilityId, userId: existing.id, invitedBy: session.user.id } });
      if (!pending) {
        await createNotification({
          userId:  existing.id,
          title:   "Invitation to work at a ground",
          message: `${session.user.name ?? "A ground owner"} invited you to be a worker at ${facility.name}. Nothing changes unless you accept.`,
          type:    "info",
          link:    "/worker-invites",
        });
        void sendWorkerInviteEmail({ to: existing.email, name: existing.name, facilityName: facility.name, ownerName: session.user.name ?? "A ground owner" });
      }

      // `worker` keeps older app builds (which read worker.name) working; `invited` tells new ones what happened
      return Response.json({
        invited: true,
        inviteId: invite.id,
        message: `${existing.name} already has a GoPlay account, so we sent them an invitation. They become your worker once they accept.`,
        worker: { id: invite.id, userId: existing.id, name: existing.name, email: existing.email, joinedAt: null, pending: true },
        isNewAccount: false,
      }, { status: 202 });
    }

    // ── A brand-new address: create the worker account directly ──
    if (await isBlocked({ email: normEmail })) {
      return Response.json({ error: "This email can't be used on GoPlay." }, { status: 409 });
    }
    const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 10);
    const user = await db.user.create({
      data: {
        name:               name || normEmail.split("@")[0],
        email:              normEmail,
        password:           await bcrypt.hash(tempPassword, 10),
        role:               "GROUND_WORKER",
        mustChangePassword: true,
      },
    });
    const worker = await db.facilityWorker.create({
      data: { facilityId, userId: user.id, addedBy: session.user.id },
    });

    await createNotification({
      userId:  user.id,
      title:   "You've been added as a Ground Worker",
      message: `You have been assigned as a worker at ${facility.name}. Log in to access your worker dashboard.`,
      type:    "info",
    });

    return Response.json({
      worker: {
        id:       worker.id,
        userId:   user.id,
        name:     user.name,
        email:    user.email,
        joinedAt: worker.createdAt,
      },
      isNewAccount: true,
      tempPassword,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/workers]", err);
    return Response.json({ error: "Failed to add worker." }, { status: 500 });
  }
}
