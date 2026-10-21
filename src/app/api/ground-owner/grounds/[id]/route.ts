import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { parsePaymentOptions } from "@/lib/payment-options";
import { notifyAdmins } from "@/lib/lobby-payments";
import { nowToSecond } from "@/lib/google-auth";

async function getOwnerProfile(userId: string) {
  return db.groundOwnerProfile.findUnique({ where: { userId } });
}

async function verifyOwnership(groundId: string, ownerId: string) {
  return db.sportsFacility.findFirst({ where: { id: groundId, ownerId } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id }  = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await db.sportsFacility.findFirst({
      where:   { id, ownerId: profile.id },
      include: { categories: { select: { id: true, name: true, icon: true } } },
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
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await verifyOwnership(id, profile.id);
    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    const { name, description, address, city, hourlyRate, capacity, amenities, images, categoryIds, paymentOptions } = await req.json();
    const payOpts = paymentOptions === undefined ? undefined : parsePaymentOptions(paymentOptions);
    if (payOpts === "invalid") return Response.json({ error: "Choose how players pay: at the ground, online, or both." }, { status: 400 });

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
    if (categoryIds !== undefined && (!Array.isArray(categoryIds) || categoryIds.length === 0)) {
      return Response.json({ error: "At least one sport category is required." }, { status: 400 });
    }

    const updated = await db.sportsFacility.update({
      where: { id },
      data: {
        ...(name        && { name }),
        ...(description !== undefined && { description }),
        ...(address     && { address }),
        ...(city        && { city }),
        ...(hourlyRate  && { hourlyRate: Number(hourlyRate) }),
        ...(payOpts !== undefined && { paymentOptions: payOpts }),
        ...(capacity    !== undefined && { capacity: capacity ? Number(capacity) : null }),
        ...(amenities   && { amenities }),
        ...(images      !== undefined && { images: Array.isArray(images) ? images : [] }),
        ...(categoryIds !== undefined && {
          categories: { set: (categoryIds as string[]).map((cid) => ({ id: cid })) },
        }),
      },
      include: { categories: { select: { id: true, name: true, icon: true } } },
    });

    return Response.json({ ground: updated, message: "Ground updated." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/grounds/:id]", err);
    return Response.json({ error: "Failed to update ground." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const profile = await getOwnerProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const ground = await verifyOwnership(id, profile.id);
    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    // Checks and writes run under the ground's row lock; booking and lobby creation re-check the
    // ground's status under the same lock, so nothing new can be booked while this decides.
    const outcome = await db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "SportsFacility" WHERE id = ${id} FOR UPDATE`;
      if (!row) return "gone" as const;

      const activeBookings = await tx.facilityBooking.count({ where: { facilityId: id, status: { in: ["CONFIRMED", "PENDING"] } } });
      if (activeBookings > 0) return "bookings" as const;
      const liveLobbies = await tx.openMatch.count({ where: { facilityId: id, status: { in: ["COLLECTING", "MATCHED"] }, preferredDate: { gte: new Date(Date.now() - 86_400_000) } } });
      if (liveLobbies > 0) return "lobbies" as const;

      // Anything that is money or someone's record: bookings, lobbies, earnings, payouts, reviews
      const counts = await Promise.all([
        tx.facilityBooking.count({ where: { facilityId: id } }),
        tx.openMatch.count({ where: { facilityId: id } }),
        tx.groundEarning.count({ where: { facilityId: id } }),
        tx.lobbyPayout.count({ where: { facilityId: id } }),
        tx.facilityReview.count({ where: { facilityId: id } }),
      ]);
      const history = counts.some((n) => n > 0);
      if (history && row.status === "INACTIVE") return "already" as const;

      // Either way the ground's workers lose it: make them players again and end their worker sessions
      const workers = await tx.facilityWorker.findMany({ where: { facilityId: id }, select: { userId: true } });
      if (workers.length) {
        await tx.facilityWorker.deleteMany({ where: { facilityId: id } });
        await tx.user.updateMany({
          where: { id: { in: workers.map((w) => w.userId) }, role: "GROUND_WORKER" },
          data:  { role: "USER", sessionsValidAfter: nowToSecond() },
        });
      }

      // Bookings, earnings and commission owed to GoPlay must never disappear, so a ground with any
      // history is taken off GoPlay instead of deleted. Only a ground that was never used is removed.
      if (history) {
        await tx.sportsFacility.update({ where: { id }, data: { status: "INACTIVE" } });
        return "archived" as const;
      }
      await tx.sportsFacility.delete({ where: { id } });
      return "deleted" as const;
    });

    switch (outcome) {
      case "gone":     return Response.json({ error: "Ground not found." }, { status: 404 });
      case "bookings": return Response.json({ error: "This ground has upcoming bookings. Cancel or complete them first." }, { status: 400 });
      case "lobbies":  return Response.json({ error: "This ground has an open match lobby that hasn't finished. Contact GoPlay support to close it first." }, { status: 400 });
      case "already":  return Response.json({ message: "This ground is already off GoPlay.", archived: true });
      case "archived":
        await notifyAdmins(
          "Ground removed by its owner",
          `${ground.name} was taken off GoPlay by its owner. Its bookings, earnings and any commission owed are kept.`,
          "/admin/grounds",
        );
        return Response.json({ message: "Ground removed from GoPlay. Its booking history and earnings are kept.", archived: true });
      case "deleted":  return Response.json({ message: "Ground deleted.", archived: false });
    }
  } catch (err) {
    console.error("[DELETE /api/ground-owner/grounds/:id]", err);
    return Response.json({ error: "Failed to delete ground." }, { status: 500 });
  }
}
