import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { sendPhoneOtp } from "@/lib/phone-otp";

// POST /api/phone-verification/send — text a 6-digit code to the number { phone }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const r = await sendPhoneOtp(session.user.id, String(body.phone ?? ""));
    if (!r.ok) return Response.json({ error: r.error, retryInSec: r.retryInSec }, { status: r.status });
    return Response.json(r);
  } catch (err) {
    console.error("[POST /api/phone-verification/send]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
