import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status, reference, notes } = await req.json();

    if (!["PROCESSING", "COMPLETED", "FAILED"].includes(status)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }

    const payout = await db.payout.update({
      where: { id },
      data: {
        status,
        reference:   reference?.trim() || null,
        notes:       notes?.trim()     || null,
        processedAt: status === "COMPLETED" || status === "FAILED" ? new Date() : null,
      },
      include: {
        owner: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // When payout completes, auto-mark all unpaid ONLINE commissions for this owner as collected
    if (status === "COMPLETED") {
      await db.groundEarning.updateMany({
        where: {
          ownerId:        payout.ownerId,
          paymentMethod:  "ONLINE",
          commissionPaid: false,
        },
        data: {
          commissionPaid:      true,
          commissionSettledAt: new Date(),
          commissionNote:      "Auto-settled via payout completion.",
        },
      });
    }

    // When payout fails after commissions were auto-settled, revert them
    if (status === "FAILED") {
      await db.groundEarning.updateMany({
        where: {
          ownerId:        payout.ownerId,
          paymentMethod:  "ONLINE",
          commissionNote: "Auto-settled via payout completion.",
          commissionPaid: true,
        },
        data: {
          commissionPaid:      false,
          commissionSettledAt: null,
          commissionNote:      null,
        },
      });
    }

    // Notify ground owner
    const msg =
      status === "COMPLETED"
        ? `Your payout of Rs. ${payout.netAmount.toLocaleString()} has been transferred to your bank account.${reference ? ` Reference: ${reference}` : ""}`
        : status === "PROCESSING"
        ? `Your payout of Rs. ${payout.netAmount.toLocaleString()} is being processed.`
        : `Your payout of Rs. ${payout.netAmount.toLocaleString()} could not be processed. Please contact support.`;

    await db.notification.create({
      data: {
        userId:  payout.owner.user.id,
        title:   status === "COMPLETED" ? "Payout Completed" : status === "PROCESSING" ? "Payout Processing" : "Payout Failed",
        message: msg,
        type:    status === "COMPLETED" ? "success" : status === "FAILED" ? "error" : "info",
      },
    });

    return Response.json({ payout });
  } catch (err) {
    console.error("[PUT /api/admin/payouts/[id]]", err);
    return Response.json({ error: "Failed to update payout." }, { status: 500 });
  }
}
