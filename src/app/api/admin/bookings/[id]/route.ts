import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/bookings/:id — everything an admin needs to understand one booking:
// who booked, the ground and its owner, how it was paid, what happened to it, and GoPlay's commission.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const b = await db.facilityBooking.findUnique({
    where: { id },
    include: {
      user:     { select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, noShowCount: true, cashCancelCount: true, requiresOnlinePayment: true, isBookingSuspended: true } },
      facility: { select: { id: true, name: true, city: true, address: true, owner: { select: { id: true, phone: true, user: { select: { id: true, name: true, email: true, phone: true } } } } } },
      court:    { select: { id: true, name: true } },
      earning:  { select: { grossAmount: true, platformFee: true, netAmount: true, commissionPaid: true, commissionSettledAt: true, commissionNote: true, earnedAt: true } },
      complaints: { select: { id: true, status: true, message: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      openMatch:  { select: { id: true, status: true, payee: true } },
    },
  });
  if (!b) return Response.json({ error: "Booking not found." }, { status: 404 });

  const names = await db.user.findMany({
    where:  { id: { in: [b.noShowMarkedBy, b.noShowReviewedBy, b.receiptReviewedBy].filter((x): x is string => !!x) } },
    select: { id: true, name: true, role: true },
  });
  const who = (uid: string | null) => names.find((n) => n.id === uid) ?? null;

  // What happened, in order. Only steps that actually occurred are listed.
  const timeline: { at: Date; label: string; detail?: string; tone: "neutral" | "good" | "warn" | "bad" }[] = [];
  timeline.push({ at: b.createdAt, label: "Booked", detail: b.paymentMethod === "ONLINE" ? "Pay by bank transfer" : "Pay cash at the ground", tone: "neutral" });
  if (b.receiptUploadedAt) timeline.push({ at: b.receiptUploadedAt, label: "Receipt uploaded", tone: "neutral" });
  if (b.receiptReviewedAt) timeline.push({
    at: b.receiptReviewedAt,
    label: b.receiptRejectReason ? "Receipt rejected" : "Payment confirmed",
    detail: b.receiptRejectReason ?? (who(b.receiptReviewedBy)?.name ? `by ${who(b.receiptReviewedBy)!.name}` : undefined),
    tone: b.receiptRejectReason ? "bad" : "good",
  });
  if (b.noShowMarkedAt) timeline.push({ at: b.noShowMarkedAt, label: "Reported as a no-show", detail: who(b.noShowMarkedBy)?.name ? `by ${who(b.noShowMarkedBy)!.name}` : undefined, tone: "warn" });
  if (b.noShowDisputedAt) timeline.push({ at: b.noShowDisputedAt, label: "Player disputed the no-show", detail: b.noShowDispute ?? undefined, tone: "neutral" });
  if (b.noShowReviewedAt) timeline.push({
    at: b.noShowReviewedAt,
    label: b.noShowReview === "OVERTURNED" ? "No-show overturned by GoPlay" : "No-show confirmed by GoPlay",
    detail: b.noShowReviewNote ?? undefined,
    tone: b.noShowReview === "OVERTURNED" ? "good" : "bad",
  });
  if (b.earning) timeline.push({ at: b.earning.earnedAt, label: "Completed", detail: `Commission Rs. ${Math.round(b.earning.platformFee).toLocaleString()}`, tone: "good" });
  if (b.cancelledAt) timeline.push({ at: b.cancelledAt, label: `Cancelled by ${b.cancelledBy === "admin" ? "GoPlay" : b.cancelledBy ?? "someone"}`, detail: b.refundNote ?? undefined, tone: "bad" });
  if (b.refundProcessedAt) timeline.push({ at: b.refundProcessedAt, label: "Refund sent", detail: b.refundAmount ? `Rs. ${Math.round(b.refundAmount).toLocaleString()}` : undefined, tone: "good" });
  timeline.sort((x, y) => x.at.getTime() - y.at.getTime());

  // Staff ids stay server-side; the reporter is sent by name
  const rest: Partial<typeof b> = { ...b };
  delete rest.noShowMarkedBy; delete rest.noShowReviewedBy; delete rest.receiptReviewedBy;
  return Response.json({
    booking: {
      ...rest,
      reporter: who(b.noShowMarkedBy),
      // Admins may cancel bookings that still hold a slot; lobby bookings are handled from the lobby
      canCancel: (b.status === "PENDING" || b.status === "CONFIRMED") && !b.isOpenMatch,
      isWalkIn:  b.specialRequests?.startsWith("[Walk-in]") ?? false,
    },
    timeline,
  });
}
