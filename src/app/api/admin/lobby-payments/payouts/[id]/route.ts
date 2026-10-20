import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// POST /api/admin/lobby-payments/payouts/[id] — { reference } — GoPlay has transferred the ground's payout
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { reference } = await req.json().catch(() => ({}));
    const ref = String(reference ?? "").trim().slice(0, 100);
    if (ref.length < 3) return Response.json({ error: "Enter the bank transfer reference." }, { status: 400 });

    const marked = await db.lobbyPayout.updateMany({
      where: { id, status: "DUE" },
      data:  { status: "PAID", reference: ref, paidAt: new Date(), paidBy: session.user.id },
    });
    if (marked.count === 0) return Response.json({ error: "This payout isn't due (already paid or cancelled)." }, { status: 409 });

    const p = await db.lobbyPayout.findUnique({
      where:   { id },
      include: { match: { select: { preferredDate: true, preferredStartTime: true, preferredEndTime: true } }, facility: { select: { name: true, owner: { select: { userId: true } } } } },
    });
    if (p) {
      await createNotification({
        userId:  p.facility.owner.userId,
        title:   "GoPlay payout sent",
        message: `GoPlay transferred Rs. ${p.amount.toLocaleString()} for the open match at ${p.facility.name} on ${p.match.preferredDate.toDateString()} ${p.match.preferredStartTime}–${p.match.preferredEndTime}. Reference: ${ref}.`,
        type:    "success",
        link:    "/ground-owner/earnings",
      });
    }
    return Response.json({ message: "Payout marked as paid." });
  } catch (err) {
    console.error("[POST /api/admin/lobby-payments/payouts/[id]]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
