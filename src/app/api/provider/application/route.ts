import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
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
