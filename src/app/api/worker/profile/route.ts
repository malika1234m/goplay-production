import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_WORKER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [user, workerRecord] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
      db.facilityWorker.findUnique({
        where: { userId: session.user.id },
        include: {
          facility: {
            select: {
              name: true, city: true, address: true,
              categories: { select: { name: true, icon: true } },
            },
          },
        },
      }),
    ]);

    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const walkins = await db.facilityBooking.count({
      where: {
        userId: session.user.id,
        specialRequests: { startsWith: "[Walk-in]" },
      },
    });

    return Response.json({
      user,
      facility: workerRecord?.facility ?? null,
      workerSince: workerRecord?.createdAt ?? null,
      stats: { walkins },
    });
  } catch (err) {
    console.error("[GET /api/worker/profile]", err);
    return Response.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_WORKER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, phone } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });

    const user = await db.user.update({
      where: { id: session.user.id },
      data:  { name: name.trim(), phone: phone?.trim() || null },
      select: { name: true, phone: true },
    });

    return Response.json({ user, message: "Profile updated." });
  } catch (err) {
    console.error("[PUT /api/worker/profile]", err);
    return Response.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
