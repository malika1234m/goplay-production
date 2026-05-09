import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function ownsGround(userId: string, facilityId: string) {
  const profile = await db.groundOwnerProfile.findUnique({ where: { userId } });
  if (!profile) return false;
  const f = await db.sportsFacility.findFirst({ where: { id: facilityId, ownerId: profile.id } });
  return !!f;
}

// PUT /api/ground-owner/grounds/[id]/courts/[courtId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; courtId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: facilityId, courtId } = await params;
    if (!await ownsGround(session.user.id, facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const court = await db.facilityCourt.findFirst({ where: { id: courtId, facilityId } });
    if (!court) return Response.json({ error: "Court not found." }, { status: 404 });

    const { name, description, isActive, sortOrder } = await req.json();
    const trimmed = (name ?? court.name).trim();
    if (!trimmed || trimmed.length < 1) {
      return Response.json({ error: "Court name is required." }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return Response.json({ error: "Court name must be under 60 characters." }, { status: 400 });
    }

    // Duplicate check (exclude self)
    const dup = await db.facilityCourt.findFirst({
      where: { facilityId, name: { equals: trimmed, mode: "insensitive" }, NOT: { id: courtId } },
    });
    if (dup) {
      return Response.json({ error: "A court with that name already exists." }, { status: 409 });
    }

    const updated = await db.facilityCourt.update({
      where: { id: courtId },
      data: {
        name:        trimmed,
        description: description !== undefined ? (description?.trim() || null) : court.description,
        isActive:    isActive    !== undefined ? isActive    : court.isActive,
        sortOrder:   sortOrder   !== undefined ? sortOrder   : court.sortOrder,
      },
      include: { _count: { select: { bookings: true } } },
    });

    return Response.json({ court: updated });
  } catch (err) {
    console.error("[PUT /api/ground-owner/grounds/:id/courts/:courtId]", err);
    return Response.json({ error: "Failed to update court." }, { status: 500 });
  }
}

// DELETE /api/ground-owner/grounds/[id]/courts/[courtId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; courtId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: facilityId, courtId } = await params;
    if (!await ownsGround(session.user.id, facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const court = await db.facilityCourt.findFirst({ where: { id: courtId, facilityId } });
    if (!court) return Response.json({ error: "Court not found." }, { status: 404 });

    const bookingCount = await db.facilityBooking.count({
      where: { courtId, status: { in: ["PENDING", "CONFIRMED"] } },
    });
    if (bookingCount > 0) {
      return Response.json(
        { error: "Cannot delete a court with active bookings. Deactivate it instead." },
        { status: 409 }
      );
    }

    await db.facilityCourt.delete({ where: { id: courtId } });
    return Response.json({ message: "Court deleted." });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/grounds/:id/courts/:courtId]", err);
    return Response.json({ error: "Failed to delete court." }, { status: 500 });
  }
}
