import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function verifyOwnership(reviewId: string, ownerId: string) {
  const profile = await db.groundOwnerProfile.findUnique({
    where: { userId: ownerId },
    include: { facilities: { select: { id: true } } },
  });
  if (!profile) return false;
  const facilityIds = profile.facilities.map((f) => f.id);
  const review = await db.facilityReview.findUnique({
    where: { id: reviewId },
    select: { facilityId: true },
  });
  return review ? facilityIds.includes(review.facilityId) : false;
}

// POST — report a review
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json().catch(() => ({ reason: undefined }));

    if (!await verifyOwnership(id, session.user.id)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db.facilityReview.update({
      where: { id },
      data: { reported: true, reportReason: reason?.trim() || null },
    });

    return Response.json({ reported: true });
  } catch (err) {
    console.error("[POST /api/ground-owner/reviews/[id]/report]", err);
    return Response.json({ error: "Failed to report review." }, { status: 500 });
  }
}

// DELETE — un-report a review (owner changed their mind)
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

    if (!await verifyOwnership(id, session.user.id)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db.facilityReview.update({
      where: { id },
      data: { reported: false, reportReason: null },
    });

    return Response.json({ reported: false });
  } catch (err) {
    console.error("[DELETE /api/ground-owner/reviews/[id]/report]", err);
    return Response.json({ error: "Failed." }, { status: 500 });
  }
}
