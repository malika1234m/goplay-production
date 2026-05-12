import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_WORKER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const facilityId = await getWorkerFacilityId(session.user.id);
    if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

    const entry = await db.blockedDate.findUnique({ where: { id } });
    if (!entry || entry.facilityId !== facilityId) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    await db.blockedDate.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/worker/blocked-dates/[id]]", err);
    return Response.json({ error: "Failed to remove blocked date." }, { status: 500 });
  }
}
