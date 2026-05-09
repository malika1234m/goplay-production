import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Verify the facility belongs to the session's ground owner
async function ownsGround(userId: string, facilityId: string) {
  const profile = await db.groundOwnerProfile.findUnique({ where: { userId } });
  if (!profile) return false;
  const f = await db.sportsFacility.findFirst({ where: { id: facilityId, ownerId: profile.id } });
  return !!f;
}

// GET /api/ground-owner/grounds/[id]/courts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: facilityId } = await params;
    if (!await ownsGround(session.user.id, facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const courts = await db.facilityCourt.findMany({
      where:   { facilityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { bookings: true } } },
    });

    return Response.json({ courts });
  } catch (err) {
    console.error("[GET /api/ground-owner/grounds/:id/courts]", err);
    return Response.json({ error: "Failed to fetch courts." }, { status: 500 });
  }
}

// POST /api/ground-owner/grounds/[id]/courts
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: facilityId } = await params;
    if (!await ownsGround(session.user.id, facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const { name, description, isActive } = await req.json();
    const trimmed = (name ?? "").trim();
    if (!trimmed || trimmed.length < 1) {
      return Response.json({ error: "Court name is required." }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return Response.json({ error: "Court name must be under 60 characters." }, { status: 400 });
    }

    // Duplicate name check within this facility
    const dup = await db.facilityCourt.findFirst({
      where: { facilityId, name: { equals: trimmed, mode: "insensitive" } },
    });
    if (dup) {
      return Response.json({ error: "A court with that name already exists." }, { status: 409 });
    }

    // Place new court at the end
    const count = await db.facilityCourt.count({ where: { facilityId } });

    const court = await db.facilityCourt.create({
      data: {
        facilityId,
        name:        trimmed,
        description: description?.trim() || null,
        isActive:    isActive !== undefined ? isActive : true,
        sortOrder:   count,
      },
      include: { _count: { select: { bookings: true } } },
    });

    return Response.json({ court }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/grounds/:id/courts]", err);
    return Response.json({ error: "Failed to create court." }, { status: 500 });
  }
}
