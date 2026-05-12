import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getOwnedFacilityIds(userId: string) {
  const profile = await db.groundOwnerProfile.findUnique({
    where: { userId },
    include: { facilities: { select: { id: true } } },
  });
  return profile?.facilities.map((f) => f.id) ?? [];
}

// DELETE /api/ground-owner/workers/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const ownedIds = await getOwnedFacilityIds(session.user.id);

    const worker = await db.facilityWorker.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!worker || !ownedIds.includes(worker.facilityId)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db.facilityWorker.delete({ where: { id } });

    // Revert their role back to USER
    await db.user.update({
      where: { id: worker.userId },
      data:  { role: "USER" },
    });

    // Notify the removed worker
    await db.notification.create({
      data: {
        userId:  worker.userId,
        title:   "Worker Access Removed",
        message: "Your access to the worker dashboard has been removed by the facility owner.",
        type:    "info",
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/workers/[id]]", err);
    return Response.json({ error: "Failed to remove worker." }, { status: 500 });
  }
}
