import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { tryMatchLobby } from "@/lib/open-match-engine";

// PATCH /api/admin/complaints/[id] — { status: "RESOLVED" | "DISMISSED", adminNote?, markPaid? }
// markPaid accepts the player's receipt on the owner's behalf once the admin has verified the transfer.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const { status, adminNote, markPaid } = await req.json();
    if (status !== "RESOLVED" && status !== "DISMISSED") {
      return Response.json({ error: 'status must be "RESOLVED" or "DISMISSED".' }, { status: 400 });
    }
    const note = typeof adminNote === "string" ? adminNote.trim().slice(0, 1000) || null : null;

    const complaint = await db.paymentComplaint.findUnique({
      where:   { id },
      include: {
        facility: { select: { name: true, owner: { select: { userId: true } } } },
        booking:  { select: { id: true, status: true, paymentStatus: true } },
        spot:     { select: { id: true, matchId: true, amountDue: true, paymentStatus: true } },
      },
    });
    if (!complaint) return Response.json({ error: "Complaint not found." }, { status: 404 });
    if (complaint.status !== "OPEN") return Response.json({ error: "This complaint is already closed." }, { status: 409 });

    let paidMatchId: string | null = null;
    if (markPaid && status === "RESOLVED") {
      if (complaint.booking && complaint.booking.paymentStatus === "REJECTED") {
        await db.facilityBooking.update({
          where: { id: complaint.booking.id },
          data:  {
            paymentStatus: "PAID",
            status:        complaint.booking.status === "PENDING" ? "CONFIRMED" : complaint.booking.status,
            receiptReviewedAt: new Date(), receiptReviewedBy: session.user.id,
          },
        });
      } else if (complaint.spot && complaint.spot.paymentStatus === "REJECTED") {
        await db.openMatchSpot.update({
          where: { id: complaint.spot.id },
          data:  { paymentStatus: "PAID", amountPaid: complaint.spot.amountDue, receiptReviewedAt: new Date(), receiptReviewedBy: session.user.id },
        });
        paidMatchId = complaint.spot.matchId;
      }
    }

    const updated = await db.paymentComplaint.update({
      where: { id },
      data:  { status, adminNote: note, resolvedAt: new Date() },
    });
    if (paidMatchId) await tryMatchLobby(paidMatchId);

    const link = complaint.spot ? `/open-matches/${complaint.spot.matchId}` : "/my-bookings";
    await createNotification({
      userId:  complaint.userId,
      title:   status === "RESOLVED" ? "Complaint resolved" : "Complaint closed",
      message: `Your payment complaint about ${complaint.facility.name} was ${status === "RESOLVED" ? "resolved" : "closed"}${markPaid && status === "RESOLVED" ? " and your payment has been accepted" : ""}.${note ? ` Note from GoPlay: ${note}` : ""}`,
      type:    status === "RESOLVED" ? "success" : "info",
      link,
    });
    if (markPaid && status === "RESOLVED") {
      await createNotification({
        userId:  complaint.facility.owner.userId,
        title:   "Payment accepted by GoPlay",
        message: `After reviewing a player's complaint, GoPlay accepted a receipt you rejected at ${complaint.facility.name}.${note ? ` Note: ${note}` : ""}`,
        type:    "warning",
      });
    }
    return Response.json({ complaint: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/complaints/[id]]", err);
    return Response.json({ error: "Failed to update complaint." }, { status: 500 });
  }
}
