import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return Response.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
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
      return Response.json({ status: "APPROVED", name: user.name });
    }

    const app = user.providerApplications[0];
    if (!app) {
      return Response.json({ status: "NOT_FOUND" });
    }

    return Response.json({
      status:          app.status,
      name:            user.name,
      submittedAt:     app.createdAt,
      rejectionReason: app.rejectionReason ?? null,
    });
  } catch (err) {
    console.error("[POST /api/auth/mobile-application-status]", err);
    return Response.json({ error: "Failed to check status." }, { status: 500 });
  }
}
