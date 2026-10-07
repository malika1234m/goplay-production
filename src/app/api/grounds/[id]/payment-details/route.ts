import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";

// GET /api/grounds/[id]/payment-details — bank details shown when a logged-in player picks "Pay online"
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

  const { id } = await params;
  const facility = await db.sportsFacility.findUnique({
    where:  { id, status: "ACTIVE" },
    select: { name: true, ...paymentDetailsSelect },
  });
  if (!facility) return Response.json({ error: "Ground not found." }, { status: 404 });

  const paymentDetails = resolvePaymentDetails(facility);
  return Response.json({ facilityName: facility.name, paymentDetails, payOnlineAvailable: !!paymentDetails });
}
