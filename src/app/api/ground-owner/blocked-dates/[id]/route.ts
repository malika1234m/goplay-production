import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    const facilityIds = profile?.facilities.map((f) => f.id) ?? [];

    const entry = await db.blockedDate.findUnique({ where: { id } });
    if (!entry || !facilityIds.includes(entry.facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    await db.blockedDate.delete({ where: { id } });
    return Response.json({ message: "Removed." });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/blocked-dates/[id]]", err);
    return Response.json({ error: "Failed to remove blocked date." }, { status: 500 });
  }
}
