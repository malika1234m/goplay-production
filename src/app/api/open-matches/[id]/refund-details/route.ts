import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { notifyAdmins, validateRefundDetails } from "@/lib/lobby-payments";

// PUT /api/open-matches/[id]/refund-details — { bankName, bankBranch?, accountName, accountNumber }
// Where GoPlay should send the refund it owes this player for the lobby. Editable until paid.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!(await isAllowed(`refund-details:${session.user.id}`, 10, 60 * 60_000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { id } = await params;
    const spot = await db.openMatchSpot.findFirst({
      where:   { matchId: id, userId: session.user.id, refundStatus: "NEEDED" },
      include: { match: { select: { preferredDate: true, facility: { select: { name: true } } } } },
    });
    if (!spot) return Response.json({ error: "There's no refund waiting for you in this lobby." }, { status: 404 });

    const v = validateRefundDetails(await req.json().catch(() => ({})));
    if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

    const first = !spot.refundDetailsAt;
    await db.openMatchSpot.update({ where: { id: spot.id }, data: { ...v.data, refundDetailsAt: new Date() } });

    if (first) {
      await notifyAdmins(
        "Refund details received",
        `${session.user.name ?? "A player"} added bank details for a Rs. ${(spot.refundAmount ?? 0).toLocaleString()} lobby refund (${spot.match.facility.name}, ${spot.match.preferredDate.toDateString()}).`,
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/open-matches/[id]/refund-details]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
