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

    if (!bankName || !(bankName as string).trim())             return Response.json({ error: "Bank name is required." }, { status: 400 });
    if ((bankName as string).trim().length > 50)               return Response.json({ error: "Bank name must be under 50 characters." }, { status: 400 });
    if (!accountNumber || !(accountNumber as string).trim())   return Response.json({ error: "Account number is required." }, { status: 400 });
    if ((accountNumber as string).trim().length < 5)           return Response.json({ error: "Account number must be at least 5 characters." }, { status: 400 });
    if ((accountNumber as string).trim().length > 20)          return Response.json({ error: "Account number must be under 20 characters." }, { status: 400 });
    if (!accountHolderName || !(accountHolderName as string).trim()) return Response.json({ error: "Account holder name is required." }, { status: 400 });
    if ((accountHolderName as string).trim().length < 2)       return Response.json({ error: "Account holder name must be at least 2 characters." }, { status: 400 });
    if ((accountHolderName as string).trim().length > 50)      return Response.json({ error: "Account holder name must be under 50 characters." }, { status: 400 });

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
