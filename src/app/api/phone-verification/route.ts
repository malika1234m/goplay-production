import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { isPhoneVerified, normalizeLkMobile } from "@/lib/phone-otp";

// GET /api/phone-verification?phone=07XXXXXXXX — has this player already proven they own this number?
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

  const phone = normalizeLkMobile(req.nextUrl.searchParams.get("phone"));
  if (!phone) return Response.json({ error: "Enter a Sri Lankan mobile number (07X XXX XXXX)." }, { status: 400 });
  return Response.json({ phone, verified: await isPhoneVerified(session.user.id, phone) });
}
