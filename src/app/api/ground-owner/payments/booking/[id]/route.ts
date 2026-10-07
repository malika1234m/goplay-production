import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { reviewBookingPayment } from "@/lib/payment-review";

// POST /api/ground-owner/payments/booking/[id] — { action: "confirm" | "reject", reason? }
// Owners and their ground workers confirm a transfer once it shows in the account.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const { action, reason } = await req.json();
    if (action !== "confirm" && action !== "reject") {
      return Response.json({ error: 'action must be "confirm" or "reject".' }, { status: 400 });
    }
    if (reason != null && typeof reason !== "string") {
      return Response.json({ error: "reason must be text." }, { status: 400 });
    }

    const result = await reviewBookingPayment({ bookingId: id, reviewer: session.user, approve: action === "confirm", reason });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ message: action === "confirm" ? "Payment confirmed." : "Receipt rejected." });
  } catch (err) {
    console.error("[POST /api/ground-owner/payments/booking/[id]]", err);
    return Response.json({ error: "Failed to review payment." }, { status: 500 });
  }
}
