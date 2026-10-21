import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { createNotification } from "@/lib/notify";
import { recomputePenalties } from "@/lib/trust";
import { earningFigures } from "@/lib/lobby-payments";
import { sendNoShowClearedEmail } from "@/lib/email";

// POST /api/admin/trust/noshow/[id] — { decision: "confirm" | "overturn", note? }
// confirm: the no-show stands. overturn: the player was there — the booking becomes completed
// (so the ground owes commission on the cash it took) and the penalty comes off the player.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { id } = await params;
    const { decision, note } = await req.json().catch(() => ({}));
    if (decision !== "confirm" && decision !== "overturn") return Response.json({ error: 'decision must be "confirm" or "overturn".' }, { status: 400 });
    const reviewNote = String(note ?? "").trim().slice(0, 500) || null;

    const b = await db.facilityBooking.findFirst({
      where:   { id, status: "NO_SHOW" },
      include: { user: { select: { id: true, name: true, email: true } }, facility: { select: { name: true, ownerId: true, owner: { select: { userId: true } } } } },
    });
    if (!b) return Response.json({ error: "No no-show report found for this booking." }, { status: 404 });
    if (b.noShowReview === "CONFIRMED" || b.noShowReview === "OVERTURNED") return Response.json({ error: "This report was already reviewed." }, { status: 409 });
    const date = b.bookingDate.toDateString();

    if (decision === "confirm") {
      // Conditional, so an automatic confirmation or a second admin at the same moment can't double up
      const { count } = await db.facilityBooking.updateMany({
        where: { id, status: "NO_SHOW", noShowReview: { notIn: ["CONFIRMED", "OVERTURNED"] } },
        data:  { noShowReview: "CONFIRMED", noShowReviewedAt: new Date(), noShowReviewedBy: admin.id, noShowReviewNote: reviewNote },
      });
      if (count === 0) return Response.json({ error: "This report was already reviewed." }, { status: 409 });
      const noShows = await recomputePenalties(b.user.id);   // it counts from now
      await createNotification({
        userId:  b.user.id,
        title:   "No-show review",
        message: b.noShowDisputedAt
          ? `GoPlay reviewed your dispute for ${b.facility.name} on ${date}. The no-show stands and counts on your account.`
          : `GoPlay confirmed the no-show reported by ${b.facility.name} for ${date}. It counts on your account.`,
        type:    "warning",
        link:    "/my-bookings",
      });
      return Response.json({ message: "No-show confirmed.", playerNoShows: noShows });
    }

    // Overturn: the game happened and the ground was paid in cash
    const { count } = await db.facilityBooking.updateMany({
      where: { id, status: "NO_SHOW", noShowReview: { notIn: ["CONFIRMED", "OVERTURNED"] } },
      data:  { status: "COMPLETED", paymentStatus: "PAID", noShowReview: "OVERTURNED", noShowReviewedAt: new Date(), noShowReviewedBy: admin.id, noShowReviewNote: reviewNote },
    });
    if (count === 0) return Response.json({ error: "This report was already reviewed." }, { status: 409 });
    if (!(await db.groundEarning.findUnique({ where: { bookingId: id }, select: { id: true } }))) {
      await db.groundEarning.create({
        data: { bookingId: id, facilityId: b.facilityId, ownerId: b.facility.ownerId, ...(await earningFigures(b)), paymentMethod: b.paymentMethod, cashConfirmed: true, commissionNote: "No-show overturned by GoPlay — cash booking completed" },
      });
    }
    const noShows = await recomputePenalties(b.user.id);
    await createNotification({ userId: b.user.id, title: "No-show removed", message: `GoPlay removed the no-show for ${b.facility.name} on ${date}. Sorry for the trouble.`, type: "success", link: "/my-bookings" });
    void sendNoShowClearedEmail({ to: b.contactEmail ?? b.user.email, name: b.user.name, facilityName: b.facility.name, date });
    await createNotification({
      userId:  b.facility.owner.userId,
      title:   "No-show overturned",
      message: `GoPlay reviewed the no-show you reported for ${b.user.name} on ${date} and found the booking went ahead. It's now marked completed and counts towards your commission.`,
      type:    "warning",
      link:    "/ground-owner/earnings",
    });
    return Response.json({ message: "No-show overturned — booking completed.", playerNoShows: noShows });
  } catch (err) {
    console.error("[POST /api/admin/trust/noshow/[id]]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
