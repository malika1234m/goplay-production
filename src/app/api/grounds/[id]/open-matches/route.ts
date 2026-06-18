import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/grounds/[id]/open-matches — active lobbies at a specific facility
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const matches = await db.openMatch.findMany({
    where: {
      facilityId: id,
      status:     "COLLECTING",
      expiresAt:  { gt: new Date() },
    },
    include: {
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      spots: {
        where:  { status: { in: ["RESERVED", "CONFIRMED"] } },
        select: { id: true, groupSize: true, user: { select: { id: true, name: true, avatar: true } } },
      },
    },
    orderBy: { preferredDate: "asc" },
  });

  return Response.json(matches);
}
