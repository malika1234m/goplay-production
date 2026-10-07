import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

const KEYS = ["commissionRate", "receiptWindowMinutes", "maintenance", "maintenanceMessage", "minAppVersion"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [commissionRate, receiptWindowMinutes, maintenance, maintenanceMessage, minAppVersion] = await Promise.all([
      getSetting("commissionRate"),
      getSetting("receiptWindowMinutes"),
      getSetting("maintenance"),
      getSetting("maintenanceMessage"),
      getSetting("minAppVersion"),
    ]);

    return Response.json({
      commissionRate:     commissionRate     ?? "10",
      receiptWindowMinutes: receiptWindowMinutes ?? "120",
      maintenance:        maintenance        ?? "false",
      maintenanceMessage: maintenanceMessage ?? "We're performing scheduled maintenance. We'll be back shortly.",
      minAppVersion:      minAppVersion      ?? "1.0.0",
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
    if ("receiptWindowMinutes" in body) {
      const v = Number(body.receiptWindowMinutes);
      if (!Number.isInteger(v) || v < 15 || v > 1440) {
        return Response.json({ error: "Receipt window must be between 15 and 1440 minutes." }, { status: 400 });
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
