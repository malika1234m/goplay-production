import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// POST /api/admin/lobby-payments/refunds/[id] (spot id)
//   { action: "refunded", reference, moneyReceived? } — GoPlay sent the refund
//   { action: "not_received" } — the receipt was never verified and the money never reached GoPlay
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { action, reference, moneyReceived } = await req.json().catch(() => ({}));

    const spot = await db.openMatchSpot.findFirst({
      where:   { id, refundStatus: "NEEDED", match: { payee: "PLATFORM" } },
      include: { match: { select: { id: true, preferredDate: true, category: { select: { name: true } }, facility: { select: { name: true } } } } },
    });
    if (!spot) return Response.json({ error: "There's no refund due on this spot." }, { status: 404 });
    const unverified = spot.paymentStatus === "RECEIPT_SUBMITTED";
    const what = `${spot.match.category.name} lobby at ${spot.match.facility.name} on ${spot.match.preferredDate.toDateString()}`;

    if (action === "not_received") {
      if (!unverified) return Response.json({ error: "This payment was already confirmed, so it must be refunded." }, { status: 409 });
      await db.openMatchSpot.update({
        where: { id },
        data:  { refundStatus: "NONE", paymentStatus: "REJECTED", receiptRejectReason: "GoPlay couldn't find this transfer in its account.", receiptReviewedAt: new Date(), receiptReviewedBy: session.user.id },
      });
      await createNotification({
        userId:  spot.userId,
        title:   "Transfer not found",
        message: `GoPlay couldn't find your transfer for the ${what}, so there's nothing to refund. If you did send it, raise a complaint with your bank receipt.`,
        type:    "error",
        link:    `/open-matches/${spot.match.id}`,
      });
      return Response.json({ message: "Closed — no refund." });
    }

    if (action !== "refunded") return Response.json({ error: 'action must be "refunded" or "not_received".' }, { status: 400 });
    // A receipt nobody checked could be fake — only refund money that actually arrived
    if (unverified && moneyReceived !== true) {
      return Response.json({ error: "Check GoPlay's bank account first: confirm the money arrived before refunding." }, { status: 409 });
    }
    const ref = String(reference ?? "").trim().slice(0, 100);
    if (ref.length < 3) return Response.json({ error: "Enter the bank transfer reference." }, { status: 400 });

    const marked = await db.openMatchSpot.updateMany({
      where: { id, refundStatus: "NEEDED" },
      data:  { refundStatus: "PROCESSED", refundReference: ref, refundedAt: new Date(), refundedBy: session.user.id, paymentStatus: "REFUNDED" },
    });
    if (marked.count === 0) return Response.json({ error: "This refund was already handled." }, { status: 409 });

    await createNotification({
      userId:  spot.userId,
      title:   "Refund sent",
      message: `GoPlay refunded Rs. ${(spot.refundAmount ?? 0).toLocaleString()} for the ${what}. Reference: ${ref}.`,
      type:    "success",
      link:    `/open-matches/${spot.match.id}`,
    });
    return Response.json({ message: "Refund marked as sent." });
  } catch (err) {
    console.error("[POST /api/admin/lobby-payments/refunds/[id]]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
