import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        bankName: true, bankBranch: true,
        accountNumber: true, accountHolderName: true,
      },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    return Response.json({ bankDetails: profile });
  } catch (err) {
    console.error("[GET /api/ground-owner/bank-details]", err);
    return Response.json({ error: "Failed to fetch bank details." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { bankName, bankBranch, accountNumber, accountHolderName } = await req.json();

    if (!bankName || !accountNumber || !accountHolderName) {
      return Response.json({ error: "Bank name, account number and account holder name are required." }, { status: 400 });
    }

    const profile = await db.groundOwnerProfile.update({
      where: { userId: session.user.id },
      data: {
        bankName:          bankName.trim(),
        bankBranch:        bankBranch?.trim() || null,
        accountNumber:     accountNumber.trim(),
        accountHolderName: accountHolderName.trim(),
      },
      select: { bankName: true, bankBranch: true, accountNumber: true, accountHolderName: true },
    });

    return Response.json({ bankDetails: profile, message: "Bank details saved." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/bank-details]", err);
    return Response.json({ error: "Failed to save bank details." }, { status: 500 });
  }
}
