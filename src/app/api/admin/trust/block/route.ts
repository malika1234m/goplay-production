import { NextRequest } from "next/server";
import type { BlockReason } from "@prisma/client";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { BLOCK_REASON_LABEL, blockAccount } from "@/lib/trust";

// POST /api/admin/trust/block — { userId, reason, details?, blockPhone? } — blocks the player and emails them why
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { userId, reason, details, blockPhone } = await req.json().catch(() => ({}));
    if (!userId) return Response.json({ error: "userId is required." }, { status: 400 });
    if (!(reason in BLOCK_REASON_LABEL)) return Response.json({ error: "Choose a reason." }, { status: 400 });
    if (reason === "OTHER" && String(details ?? "").trim().length < 5) return Response.json({ error: "Explain the reason in the details." }, { status: 400 });

    const r = await blockAccount({ userId, reason: reason as BlockReason, details, blockPhone: !!blockPhone, adminId: admin.id });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ message: "Account blocked and the player has been emailed.", cancelledBookings: r.cancelledBookings, paidUpcoming: r.paidUpcoming });
  } catch (err) {
    console.error("[POST /api/admin/trust/block]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
