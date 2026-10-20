import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";
import { PLATFORM_BANK_KEYS, getPlatformPaymentDetails, setPlatformPaymentDetails } from "@/lib/lobby-payments";

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

    // GoPlay's account for open match payments (blank fields until an admin fills them in)
    const bank = await Promise.all(Object.values(PLATFORM_BANK_KEYS).map((k) => getSetting(k)));
    const [bankName, bankBranch, accountName, accountNumber, instructions] = bank.map((v) => v ?? "");

    return Response.json({
      platformBank:       { bankName, bankBranch, accountName, accountNumber, instructions },
      platformBankReady:  !!(await getPlatformPaymentDetails()),
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

    if (body.platformBank && typeof body.platformBank === "object") {
      const b = body.platformBank as Record<string, unknown>;
      const number = String(b.accountNumber ?? "").replace(/[\s-]/g, "");
      if (number && !/^\d{6,20}$/.test(number)) {
        return Response.json({ error: "Account number must be 6–20 digits." }, { status: 400 });
      }
      await setPlatformPaymentDetails({
        bankName: String(b.bankName ?? ""), bankBranch: String(b.bankBranch ?? ""),
        accountName: String(b.accountName ?? ""), accountNumber: number, instructions: String(b.instructions ?? ""),
      });
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
