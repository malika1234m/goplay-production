import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const ground = await db.sportsFacility.findUnique({
      where: { id },
      include: {
        categories: { select: { id: true, name: true, icon: true } },
        owner: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
          },
        },
        availability: { orderBy: { dayOfWeek: "asc" } },
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    if (!ground) return Response.json({ error: "Ground not found." }, { status: 404 });

    return Response.json({ ground });
  } catch (err) {
    console.error("[GET /api/admin/grounds/:id]", err);
    return Response.json({ error: "Failed to fetch ground." }, { status: 500 });
  }
}
