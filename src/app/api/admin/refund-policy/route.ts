import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { DEFAULT_POLICY_TIERS, PolicyTier } from "@/lib/cancellation-policy";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await db.platformSetting.findUnique({ where: { key: "refund_policy" } });
    const tiers: PolicyTier[] = row
      ? (JSON.parse(row.value) as PolicyTier[])
      : DEFAULT_POLICY_TIERS;

    return Response.json({ tiers });
  } catch (err) {
    console.error("[GET /api/admin/refund-policy]", err);
    return Response.json({ error: "Failed to load policy." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json() as { tiers: PolicyTier[] };

    if (!Array.isArray(body.tiers) || body.tiers.length < 1) {
      return Response.json({ error: "At least one tier is required." }, { status: 400 });
    }

    for (const t of body.tiers) {
      if (typeof t.minHours !== "number" || typeof t.refundPercent !== "number") {
        return Response.json({ error: "Each tier must have minHours and refundPercent." }, { status: 400 });
      }
      if (t.refundPercent < 0 || t.refundPercent > 100) {
        return Response.json({ error: "refundPercent must be between 0 and 100." }, { status: 400 });
      }
      if (t.minHours < 0) {
        return Response.json({ error: "minHours must be non-negative." }, { status: 400 });
      }
    }

    const sorted = [...body.tiers].sort((a, b) => b.minHours - a.minHours);

    if (sorted[sorted.length - 1].minHours !== 0) {
      return Response.json({ error: "One tier must have minHours = 0 as the fallback." }, { status: 400 });
    }

    await db.platformSetting.upsert({
      where:  { key: "refund_policy" },
      update: { value: JSON.stringify(sorted) },
      create: { key: "refund_policy", value: JSON.stringify(sorted) },
    });

    return Response.json({ message: "Policy saved.", tiers: sorted });
  } catch (err) {
    console.error("[PUT /api/admin/refund-policy]", err);
    return Response.json({ error: "Failed to save policy." }, { status: 500 });
  }
}
