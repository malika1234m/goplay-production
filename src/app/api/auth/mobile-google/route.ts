import { NextRequest } from "next/server";
import { getClientIp, isAllowed } from "@/lib/rateLimiter";
import { signMobileToken } from "@/lib/mobile-auth";
import { findOrCreateGoogleUser, verifyGoogleIdToken } from "@/lib/google-auth";

// POST /api/auth/mobile-google — { idToken } from the app's Google sign-in → same session as mobile-login
export async function POST(req: NextRequest) {
  try {
    if (!(await isAllowed(`google-login-ip:${getClientIp(req)}`, 30, 15 * 60_000))) {
      return Response.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    const { idToken } = await req.json().catch(() => ({}));
    const profile = await verifyGoogleIdToken(String(idToken ?? ""));
    if (!profile) return Response.json({ error: "Google sign-in failed. Please try again." }, { status: 401 });

    const user = await findOrCreateGoogleUser(profile);
    if (!user || !user.isActive) {
      return Response.json({ error: "Your account has been deactivated. Please contact support." }, { status: 403 });
    }
    if (!["USER", "GROUND_OWNER", "GROUND_WORKER"].includes(user.role)) {
      return Response.json({ error: "This account cannot sign in from the mobile app." }, { status: 403 });
    }

    const token     = await signMobileToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return Response.json({ token, expiresAt, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("[POST /api/auth/mobile-google]", err);
    return Response.json({ error: "Login failed." }, { status: 500 });
  }
}
