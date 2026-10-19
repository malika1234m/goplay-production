import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { sendEmailOtp } from "@/lib/email-otp";

// POST /api/email-verification/send — email a 6-digit booking code to { email }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const r = await sendEmailOtp(session.user.id, String(body.email ?? ""));
    if (!r.ok) return Response.json({ error: r.error, retryInSec: r.retryInSec }, { status: r.status });
    return Response.json(r);
  } catch (err) {
    console.error("[POST /api/email-verification/send]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
