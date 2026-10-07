import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

const FIELDS = {
  paymentBankName:      true,
  paymentBankBranch:    true,
  paymentAccountName:   true,
  paymentAccountNumber: true,
  paymentInstructions:  true,
} as const;

async function ownedFacility(userId: string, id: string) {
  return db.sportsFacility.findFirst({ where: { id, owner: { userId } }, select: { id: true, ...FIELDS } });
}

// GET /api/ground-owner/grounds/[id]/payment-details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user || session.user.role !== "GROUND_OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const facility = await ownedFacility(session.user.id, id);
  if (!facility) return Response.json({ error: "Ground not found." }, { status: 404 });
  return Response.json({ paymentDetails: facility });
}

// PUT /api/ground-owner/grounds/[id]/payment-details — all blank clears them (falls back to profile bank details)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (!(await ownedFacility(session.user.id, id))) return Response.json({ error: "Ground not found." }, { status: 404 });

    const body = await req.json();
    const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const bankName      = clean(body.paymentBankName);
    const bankBranch    = clean(body.paymentBankBranch);
    const accountName   = clean(body.paymentAccountName);
    const accountNumber = clean(body.paymentAccountNumber);
    const instructions  = clean(body.paymentInstructions);

    const anyAccountField = bankName || bankBranch || accountName || accountNumber;
    if (anyAccountField) {
      if (!bankName || bankName.length > 50)             return Response.json({ error: "Bank name is required (max 50 characters)." }, { status: 400 });
      if (!accountName || accountName.length < 2 || accountName.length > 60) return Response.json({ error: "Account holder name must be 2–60 characters." }, { status: 400 });
      if (!/^[0-9\- ]{5,24}$/.test(accountNumber))       return Response.json({ error: "Account number must be 5–24 digits." }, { status: 400 });
      if (bankBranch.length > 60)                        return Response.json({ error: "Branch must be under 60 characters." }, { status: 400 });
    }
    if (instructions.length > 500) return Response.json({ error: "Instructions must be under 500 characters." }, { status: 400 });

    const facility = await db.sportsFacility.update({
      where:  { id },
      data:   {
        paymentBankName:      bankName      || null,
        paymentBankBranch:    bankBranch    || null,
        paymentAccountName:   accountName   || null,
        paymentAccountNumber: accountNumber || null,
        paymentInstructions:  instructions  || null,
      },
      select: FIELDS,
    });
    return Response.json({ paymentDetails: facility, message: "Payment details saved." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/grounds/[id]/payment-details]", err);
    return Response.json({ error: "Failed to save payment details." }, { status: 500 });
  }
}
