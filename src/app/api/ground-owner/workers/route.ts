import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

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
    const session = await auth();
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

    return Response.json({
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
    const session = await auth();
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

    let user = await db.user.findUnique({ where: { email } });

    const tempPassword = Math.random().toString(36).slice(-8);
    let isNewAccount = false;

    if (!user) {
      const hashed = await bcrypt.hash(tempPassword, 10);
      user = await db.user.create({
        data: {
          name:               name || email.split("@")[0],
          email,
          password:           hashed,
          role:               "GROUND_WORKER",
          mustChangePassword: true,
        },
      });
      isNewAccount = true;
    } else {
      // Prevent demoting admins or other owners
      if (user.role === "ADMIN" || user.role === "GROUND_OWNER") {
        return Response.json({
          error: "This account cannot be assigned as a worker.",
        }, { status: 409 });
      }

      // Check not already assigned
      const existing = await db.facilityWorker.findUnique({ where: { userId: user.id } });
      if (existing) {
        return Response.json({
          error: existing.facilityId === facilityId
            ? "This person is already a worker at this facility."
            : "This person is already assigned to another facility.",
        }, { status: 409 });
      }

      await db.user.update({ where: { id: user.id }, data: { role: "GROUND_WORKER" } });
    }

    const worker = await db.facilityWorker.create({
      data: { facilityId, userId: user.id, addedBy: session.user.id },
    });

    const facility = await db.sportsFacility.findUnique({
      where: { id: facilityId },
      select: { name: true },
    });

    await db.notification.create({
      data: {
        userId:  user.id,
        title:   "You've been added as a Ground Worker",
        message: `You have been assigned as a worker at ${facility?.name ?? "a facility"}. Log in to access your worker dashboard.`,
        type:    "info",
      },
    });

    return Response.json({
      worker: {
        id:       worker.id,
        userId:   user.id,
        name:     user.name,
        email:    user.email,
        joinedAt: worker.createdAt,
      },
      isNewAccount,
      tempPassword: isNewAccount ? tempPassword : undefined,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/workers]", err);
    return Response.json({ error: "Failed to add worker." }, { status: 500 });
  }
}
