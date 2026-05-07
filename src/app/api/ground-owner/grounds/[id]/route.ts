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

    if (name !== undefined) {
      const n = (name ?? "").trim();
      if (!n || n.length < 3)  return Response.json({ error: "Ground name must be at least 3 characters." }, { status: 400 });
      if (n.length > 100)      return Response.json({ error: "Ground name must be under 100 characters." }, { status: 400 });
    }
    if (address !== undefined) {
      const a = (address ?? "").trim();
      if (!a || a.length < 5)  return Response.json({ error: "Address must be at least 5 characters." }, { status: 400 });
    }
    if (city !== undefined) {
      const c = (city ?? "").trim();
      if (!c || c.length < 2)  return Response.json({ error: "City must be at least 2 characters." }, { status: 400 });
    }
    if (hourlyRate !== undefined) {
      const r = Number(hourlyRate);
      if (r < 1)     return Response.json({ error: "Hourly rate must be at least Rs. 1." }, { status: 400 });
      if (r > 100000) return Response.json({ error: "Hourly rate cannot exceed Rs. 100,000." }, { status: 400 });
    }
    if (capacity !== undefined && capacity !== null) {
      const cap = Number(capacity);
      if (cap < 1)   return Response.json({ error: "Capacity must be at least 1 player." }, { status: 400 });
      if (cap > 500) return Response.json({ error: "Capacity cannot exceed 500 players." }, { status: 400 });
    }

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
