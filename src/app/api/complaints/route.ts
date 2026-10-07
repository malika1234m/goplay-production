import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { createPaymentComplaint } from "@/lib/payment-review";

// GET /api/complaints — the player's own payment complaints
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
  const complaints = await db.paymentComplaint.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select:  { id: true, bookingId: true, spotId: true, message: true, status: true, adminNote: true, createdAt: true, resolvedAt: true, facility: { select: { name: true } } },
  });
  return Response.json({ complaints });
}

// POST /api/complaints — { bookingId | spotId, message } — dispute a rejected receipt
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!isAllowed(`complaint:${session.user.id}`, 5, 60_000)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }
    const { bookingId, spotId, message } = await req.json();
    const result = await createPaymentComplaint({ userId: session.user.id, bookingId, spotId, message: String(message ?? "") });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ id: result.complaintId, message: "Complaint submitted. The GoPlay team will review it." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/complaints]", err);
    return Response.json({ error: "Failed to submit complaint." }, { status: 500 });
  }
}
