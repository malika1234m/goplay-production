import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";
import { getReceiptWindowMinutes } from "@/lib/settings";
import { getPlatformPaymentDetails } from "@/lib/lobby-payments";
import { expireLobby, publicLobby } from "@/lib/open-match-engine";

// GET /api/open-matches/[id] — lobby detail
// Players see co-player contact info only after they have a RESERVED/CONFIRMED spot
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(req);

  // Out of time without filling: close it first, so players see the refund straight away
  const head = await db.openMatch.findUnique({ where: { id }, select: { status: true, expiresAt: true } });
  if (head?.status === "COLLECTING" && head.expiresAt <= new Date()) {
    await expireLobby(id).catch((e) => console.error("[open-matches/:id] lazy expiry", e));
  }

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

  // Co-players' phone numbers are for people who have actually paid into this lobby, and only for
  // players still in it. Emails are never shared; joining alone (free until paid) reveals nothing.
  const currentUserId = session?.user?.id;
  const live          = (s: { status: string }) => ["RESERVED", "CONFIRMED"].includes(s.status);
  const isParticipant = match.spots.some((s) => s.user.id === currentUserId && live(s) && s.paymentStatus === "PAID");

  const spotsForResponse = match.spots.map((s) => ({
    ...s,
    user: {
      id: s.user.id, name: s.user.name, avatar: s.user.avatar,
      phone: isParticipant && live(s) ? s.user.phone : null,
      email: null,
    },
  }));

  // The caller's own spot, with what they owe and where to send it while it is unpaid
  const mine = currentUserId
    ? await db.openMatchSpot.findFirst({
        where:   { matchId: id, userId: currentUserId },
        orderBy: { createdAt: "desc" },
        select:  {
          id: true, groupSize: true, status: true, paymentStatus: true, amountDue: true, amountPaid: true, createdAt: true,
          receiptUrl: true, receiptUploadedAt: true, receiptReviewedAt: true, receiptRejectReason: true,
          refundStatus: true, refundAmount: true, refundDetailsAt: true, refundedAt: true, refundReference: true,
          complaints: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, adminNote: true, createdAt: true } },
        },
      })
    : null;
  let mySpot = null;
  if (mine) {
    const { complaints, ...spot } = mine;
    const unpaid = spot.status === "RESERVED" && spot.paymentStatus !== "PAID";
    // GoPlay-collected lobbies pay GoPlay's account; older lobbies still pay the ground
    let paymentDetails = null;
    if (unpaid && match.payee === "PLATFORM") paymentDetails = await getPlatformPaymentDetails();
    else if (unpaid) {
      const f = await db.sportsFacility.findUnique({ where: { id: match.facilityId }, select: paymentDetailsSelect });
      paymentDetails = f ? resolvePaymentDetails(f) : null;
    }
    mySpot = {
      ...spot,
      latestComplaint:      complaints[0] ?? null,
      payTo:                match.payee === "PLATFORM" ? "GOPLAY" : "GROUND",
      paymentDetails,
      receiptWindowMinutes: unpaid ? await getReceiptWindowMinutes() : null,
    };
  }

  return Response.json({ ...publicLobby(match), spots: spotsForResponse, mySpot });
}
