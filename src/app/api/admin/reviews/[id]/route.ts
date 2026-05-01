import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await db.facilityReview.delete({ where: { id } });

    return Response.json({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/admin/reviews/[id]]", err);
    return Response.json({ error: "Failed to delete review." }, { status: 500 });
  }
}
