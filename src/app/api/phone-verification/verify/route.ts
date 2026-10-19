import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { verifyPhoneOtp } from "@/lib/phone-otp";

// POST /api/phone-verification/verify — check the code { phone, code }; on success the number is verified for this account
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const r = await verifyPhoneOtp(session.user.id, String(body.phone ?? ""), String(body.code ?? "").trim());
    if (!r.ok) return Response.json({ error: r.error, retryInSec: r.retryInSec }, { status: r.status });
    return Response.json(r);
  } catch (err) {
    console.error("[POST /api/phone-verification/verify]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
