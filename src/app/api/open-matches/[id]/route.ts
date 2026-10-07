import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";
import { getReceiptWindowMinutes } from "@/lib/settings";

// GET /api/open-matches/[id] — lobby detail
// Players see co-player contact info only after they have a RESERVED/CONFIRMED spot
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(req);

  const match = await db.openMatch.findUnique({
    where: { id },
    include: {
      facility: { select: { id: true, name: true, address: true, city: true, images: true, hourlyRate: true, latitude: true, longitude: true, capacity: true } },
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      court:    { select: { name: true } },
      spots: {
        where:  { status: { in: ["RESERVED", "CONFIRMED", "CANCELLED", "REFUNDED"] } },
        select: {
          id: true, groupSize: true, status: true, paymentStatus: true, createdAt: true,
          user: { select: { id: true, name: true, avatar: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!match) return Response.json({ error: "Lobby not found." }, { status: 404 });

  // Hide contact details (phone/email) for users who haven't paid into this lobby
  const currentUserId = session?.user?.id;
  const isParticipant = match.spots.some(
    (s) => s.user.id === currentUserId && ["RESERVED", "CONFIRMED"].includes(s.status),
  );

  const spotsForResponse = match.spots.map((s) => ({
    ...s,
    user: isParticipant
      ? s.user
      : { id: s.user.id, name: s.user.name, avatar: s.user.avatar, phone: null, email: null },
  }));

  // The caller's own spot, with what they owe and where to send it while it is unpaid
  const mine = currentUserId
    ? await db.openMatchSpot.findFirst({
        where:   { matchId: id, userId: currentUserId },
        orderBy: { createdAt: "desc" },
        select:  {
          id: true, groupSize: true, status: true, paymentStatus: true, amountDue: true, amountPaid: true, createdAt: true,
          receiptUrl: true, receiptUploadedAt: true, receiptReviewedAt: true, receiptRejectReason: true,
          complaints: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, adminNote: true, createdAt: true } },
        },
      })
    : null;
  let mySpot = null;
  if (mine) {
    const { complaints, ...spot } = mine;
    const unpaid = spot.status === "RESERVED" && spot.paymentStatus !== "PAID";
    const facilityPayment = unpaid
      ? await db.sportsFacility.findUnique({ where: { id: match.facilityId }, select: paymentDetailsSelect })
      : null;
    mySpot = {
      ...spot,
      latestComplaint:      complaints[0] ?? null,
      paymentDetails:       facilityPayment ? resolvePaymentDetails(facilityPayment) : null,
      receiptWindowMinutes: unpaid ? await getReceiptWindowMinutes() : null,
    };
  }

  return Response.json({ ...match, spots: spotsForResponse, mySpot });
}
