import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const q      = searchParams.get("q")      ?? "";

    const applications = await db.providerApplication.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(q && {
          user: {
            OR: [
              { name:  { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }),
      },
      include: {
        user:     { select: { name: true, email: true, phone: true } },
        category: { select: { name: true, icon: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const all = await db.providerApplication.groupBy({ by: ["status"], _count: true });
    const summary = {
      pending:  all.find((a) => a.status === "PENDING")?._count  ?? 0,
      approved: all.find((a) => a.status === "APPROVED")?._count ?? 0,
      rejected: all.find((a) => a.status === "REJECTED")?._count ?? 0,
    };

    return Response.json({ applications, summary });
  } catch (err) {
    console.error("[GET /api/admin/applications]", err);
    return Response.json({ error: "Failed to fetch applications." }, { status: 500 });
  }
}
