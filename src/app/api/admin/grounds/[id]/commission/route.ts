import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getDefaultCommissionRate } from "@/lib/settings";
import { createNotification } from "@/lib/notify";

// PUT /api/admin/grounds/:id/commission — set a ground's own commission rate (percent), or
// clear it (rate: null) so the ground follows the platform default from Settings.
// Applies to bookings completed from now on; earnings already recorded keep their fee.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const raw    = body.rate;
  const rate   = raw === null || raw === "" ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 50)) {
    return Response.json({ error: "Commission must be between 0% and 50%." }, { status: 400 });
  }
  const rounded = rate === null ? null : Math.round(rate * 100) / 100;

  const ground = await db.sportsFacility.findUnique({
    where:  { id },
    select: { id: true, name: true, commissionRate: true, owner: { select: { userId: true } } },
  });
  if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

  await db.sportsFacility.update({ where: { id }, data: { commissionRate: rounded } });

  const defaultPct   = Math.round((await getDefaultCommissionRate()) * 10000) / 100;
  const effectivePct = rounded ?? defaultPct;
  const previousPct  = ground.commissionRate ?? defaultPct;

  if (body.notifyOwner !== false && effectivePct !== previousPct) {
    await createNotification({
      userId:  ground.owner.userId,
      title:   "GoPlay commission updated",
      message: `GoPlay's commission for ${ground.name} is now ${effectivePct}% on bookings completed from today. Earlier bookings are unchanged.`,
      type:    "info",
      link:    "/ground-owner/earnings",
    });
  }

  return Response.json({ ok: true, commissionRate: rounded, effectiveRate: effectivePct, defaultRate: defaultPct });
}
