import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const application = await db.providerApplication.findFirst({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ application });
  } catch (err) {
    console.error("[GET /api/provider/application]", err);
    return Response.json({ error: "Failed to fetch application." }, { status: 500 });
  }
}
