import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getOwnerProfile(userId: string) {
  return db.groundOwnerProfile.findUnique({ where: { userId } });
}

async function verifyOwnership(groundId: string, ownerId: string) {
  return db.sportsFacility.findFirst({ where: { id: groundId, ownerId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id }  = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await db.sportsFacility.findFirst({
      where:   { id, ownerId: profile.id },
      include: { category: { select: { id: true, name: true, icon: true } } },
    });
    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    return Response.json({ ground });
  } catch (err) {
    console.error("[GET /api/ground-owner/grounds/:id]", err);
    return Response.json({ error: "Failed to fetch ground." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await verifyOwnership(id, profile.id);
    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    const { name, description, address, city, hourlyRate, capacity, amenities, images } = await req.json();

    const updated = await db.sportsFacility.update({
      where: { id },
      data: {
        ...(name        && { name }),
        ...(description !== undefined && { description }),
        ...(address     && { address }),
        ...(city        && { city }),
        ...(hourlyRate  && { hourlyRate: Number(hourlyRate) }),
        ...(capacity    !== undefined && { capacity: capacity ? Number(capacity) : null }),
        ...(amenities   && { amenities }),
        ...(images      !== undefined && { images: Array.isArray(images) ? images : [] }),
      },
    });

    return Response.json({ ground: updated, message: "Ground updated." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/grounds/:id]", err);
    return Response.json({ error: "Failed to update ground." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await verifyOwnership(id, profile.id);
    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    const hasActiveBookings = await db.facilityBooking.findFirst({
      where: { facilityId: id, status: { in: ["CONFIRMED", "PENDING"] } },
    });
    if (hasActiveBookings) {
      return Response.json({ error: "Cannot delete a ground with active bookings." }, { status: 400 });
    }

    await db.sportsFacility.delete({ where: { id } });

    return Response.json({ message: "Ground deleted." });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/grounds/:id]", err);
    return Response.json({ error: "Failed to delete ground." }, { status: 500 });
  }
}
