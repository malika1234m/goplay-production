import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ComplaintStatus } from "@prisma/client";

// GET /api/admin/complaints?status=OPEN|RESOLVED|DISMISSED|ALL
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const raw    = new URL(req.url).searchParams.get("status") ?? "OPEN";
  const status = (["OPEN", "RESOLVED", "DISMISSED"] as const).includes(raw as ComplaintStatus) ? (raw as ComplaintStatus) : undefined;

  const complaints = await db.paymentComplaint.findMany({
    where:   status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take:    200,
    include: {
      user:     { select: { id: true, name: true, email: true, phone: true } },
      facility: { select: { id: true, name: true, owner: { select: { user: { select: { name: true, email: true, phone: true } } } } } },
      booking:  { select: { id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, status: true, paymentStatus: true, receiptUrl: true, receiptRejectReason: true, receiptReviewedAt: true } },
      spot:     { select: { id: true, amountDue: true, status: true, paymentStatus: true, receiptUrl: true, receiptRejectReason: true, receiptReviewedAt: true, match: { select: { id: true, preferredDate: true, preferredStartTime: true, preferredEndTime: true } } } },
    },
  });
  const openCount = await db.paymentComplaint.count({ where: { status: "OPEN" } });
  return Response.json({ complaints, openCount });
}
