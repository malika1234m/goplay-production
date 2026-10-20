import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { reviewSpotPayment } from "@/lib/payment-review";

// POST /api/admin/lobby-payments/spots/[id] — { action: "confirm" | "reject", reason? }
// Confirm only once the money is in GoPlay's account; confirming can fill the lobby and book the court.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });
    const { id } = await params;
    const { action, reason } = await req.json().catch(() => ({}));
    if (action !== "confirm" && action !== "reject") return Response.json({ error: 'action must be "confirm" or "reject".' }, { status: 400 });

    const result = await reviewSpotPayment({ spotId: id, reviewer: session.user, approve: action === "confirm", reason });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ message: action === "confirm" ? "Payment confirmed." : "Receipt rejected." });
  } catch (err) {
    console.error("[POST /api/admin/lobby-payments/spots/[id]]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
