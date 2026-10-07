import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { uploadReceiptFromForm } from "@/lib/receipt-upload";
import { submitSpotReceipt } from "@/lib/payment-review";

// POST /api/open-matches/[id]/receipt — player uploads the transfer receipt for their spot in this lobby
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!isAllowed(`receipt:${session.user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const { id } = await params;
    const spot = await db.openMatchSpot.findFirst({
      where:  { matchId: id, userId: session.user.id, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] }, match: { status: "COLLECTING" } },
      select: { id: true },
    });
    if (!spot) return Response.json({ error: "You don't have a spot waiting for payment in this lobby." }, { status: 404 });

    const upload = await uploadReceiptFromForm(await req.formData());
    if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status });

    const result = await submitSpotReceipt(spot.id, session.user.id, upload.url);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ receiptUrl: upload.url, message: "Receipt sent to the ground for review." });
  } catch (err) {
    console.error("[POST /api/open-matches/[id]/receipt]", err);
    return Response.json({ error: "Failed to upload receipt." }, { status: 500 });
  }
}
