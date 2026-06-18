import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { expireLobby } from "@/lib/open-match-engine";
import { createNotification } from "@/lib/notify";

// GET — all lobbies with full detail
// ?facilityId=  filter to one facility
// ?status=      filter by lobby status (e.g. COLLECTING, EXPIRED)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const facilityId = searchParams.get("facilityId")?.trim();
  const status     = searchParams.get("status")?.trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};
  if (facilityId) whereClause.facilityId = facilityId;
  if (status)     whereClause.status     = status;

  const matches = await db.openMatch.findMany({
    where: whereClause,
    include: {
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      facility: { select: { id: true, name: true, city: true, hourlyRate: true } },
      spots: {
        select: {
          id: true, groupSize: true, status: true, paymentStatus: true,
          amountPaid: true, cancelledAt: true, createdAt: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(matches);
}

// POST — cancel a lobby  { matchId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { matchId } = await req.json();
  if (!matchId) return Response.json({ error: "matchId required." }, { status: 400 });

  const refunded = await expireLobby(matchId, "This lobby was cancelled by GoPlay admin.");
  return Response.json({ message: `Lobby cancelled. ${refunded} spot(s) refunded.` });
}

// PATCH — mark a spot refund as processed  { spotId }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { spotId } = await req.json();
  if (!spotId) return Response.json({ error: "spotId required." }, { status: 400 });

  const spot = await db.openMatchSpot.findUnique({
    where:   { id: spotId },
    include: {
      user:  { select: { id: true, name: true, email: true } },
      match: {
        select: {
          id: true,
          facility: { select: { name: true } },
          category: { select: { name: true } },
          preferredDate: true,
        },
      },
    },
  });

  if (!spot)                          return Response.json({ error: "Spot not found." },                  { status: 404 });
  if (spot.status !== "REFUNDED")     return Response.json({ error: "Spot is not in REFUNDED status." }, { status: 400 });
  if (spot.paymentStatus !== "PENDING") return Response.json({ error: "Refund already marked processed." }, { status: 400 });

  await db.openMatchSpot.update({
    where: { id: spotId },
    data:  { amountPaid: 0, paymentStatus: "REFUNDED" },
  });

  const amountText = spot.amountPaid > 0 ? ` of Rs. ${spot.amountPaid.toLocaleString()}` : "";
  await createNotification({
    userId:  spot.user.id,
    title:   "Refund Processed",
    message: `Your refund${amountText} for the ${spot.match.category.name} lobby at ${spot.match.facility.name} has been processed by GoPlay.`,
    type:    "success",
    link:    `/open-matches/${spot.match.id}`,
  });

  return Response.json({ message: "Refund marked as processed." });
}
