import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, isAllowed } from "@/lib/rateLimiter";

// Looked up by email alone (the owner app checks before the applicant can sign in), so it says as
// little as possible and is rate-limited per address and per IP to stop it being used to probe accounts.

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(() => ({}));
    if (typeof email !== "string" || !email.trim()) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }
    const addr = email.trim().toLowerCase();
    const ip   = getClientIp(req);
    if (!(await isAllowed(`app-status-ip:${ip}`, 20, 60 * 60_000)) || !(await isAllowed(`app-status:${addr}`, 10, 60 * 60_000))) {
      return Response.json({ error: "Too many checks. Please try again in an hour." }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { email: addr },
      include: {
        providerApplications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return Response.json({ status: "NOT_FOUND" });
    }

    // If user is already approved as GROUND_OWNER
    if (user.role === "GROUND_OWNER") {
      return Response.json({ status: "APPROVED" });
    }

    const app = user.providerApplications[0];
    if (!app) {
      return Response.json({ status: "NOT_FOUND" });
    }

    return Response.json({
      status:          app.status,
      submittedAt:     app.createdAt,
      rejectionReason: app.rejectionReason ?? null,
    });
  } catch (err) {
    console.error("[POST /api/auth/mobile-application-status]", err);
    return Response.json({ error: "Failed to check status." }, { status: 500 });
  }
}
