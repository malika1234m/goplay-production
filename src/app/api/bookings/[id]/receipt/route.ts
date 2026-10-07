import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { uploadReceiptFromForm } from "@/lib/receipt-upload";
import { submitBookingReceipt } from "@/lib/payment-review";

// POST /api/bookings/[id]/receipt — player uploads the bank transfer receipt (multipart field "receipt")
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!isAllowed(`receipt:${session.user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const { id } = await params;
    // Check the booking is the caller's and still awaiting a receipt before storing any file
    const booking = await db.facilityBooking.findFirst({
      where:  { id, userId: session.user.id, paymentMethod: "ONLINE", status: "PENDING", paymentStatus: { in: ["PENDING", "REJECTED"] } },
      select: { id: true },
    });
    if (!booking) return Response.json({ error: "This booking isn't waiting for a payment receipt." }, { status: 409 });

    const upload = await uploadReceiptFromForm(await req.formData());
    if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status });

    const result = await submitBookingReceipt(id, session.user.id, upload.url);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ receiptUrl: upload.url, message: "Receipt sent to the ground for review." });
  } catch (err) {
    console.error("[POST /api/bookings/[id]/receipt]", err);
    return Response.json({ error: "Failed to upload receipt." }, { status: 500 });
  }
}
