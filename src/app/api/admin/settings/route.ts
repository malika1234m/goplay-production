import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

const KEYS = ["commissionRate", "minPayout", "payoutCooldownDays"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [commissionRate, minPayout, payoutCooldownDays] = await Promise.all([
      getSetting("commissionRate"),
      getSetting("minPayout"),
      getSetting("payoutCooldownDays"),
    ]);

    return Response.json({
      commissionRate:     commissionRate     ?? "10",
      minPayout:          minPayout          ?? "1000",
      payoutCooldownDays: payoutCooldownDays ?? "7",
    });
  } catch (err) {
    console.error("[GET /api/admin/settings]", err);
    return Response.json({ error: "Failed to fetch settings." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    if ("commissionRate" in body) {
      const v = Number(body.commissionRate);
      if (isNaN(v) || v < 0 || v > 50) {
        return Response.json({ error: "Commission rate must be between 0% and 50%." }, { status: 400 });
      }
    }
    if ("minPayout" in body) {
      const v = Number(body.minPayout);
      if (isNaN(v) || v < 0) {
        return Response.json({ error: "Minimum payout must be a positive number." }, { status: 400 });
      }
    }
    if ("payoutCooldownDays" in body) {
      const v = Number(body.payoutCooldownDays);
      if (isNaN(v) || v < 0 || v > 90) {
        return Response.json({ error: "Cooldown must be between 0 and 90 days." }, { status: 400 });
      }
    }

    await Promise.all(
      KEYS.filter((k) => k in body).map((k) => setSetting(k, String(body[k])))
    );

    return Response.json({ message: "Settings saved." });
  } catch (err) {
    console.error("[PUT /api/admin/settings]", err);
    return Response.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
