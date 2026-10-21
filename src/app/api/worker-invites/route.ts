import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

// GET /api/worker-invites — the signed-in player's unanswered invitations to work at a ground
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

  const invites = await db.workerInvite.findMany({
    where:   { userId: session.user.id, status: "PENDING", facility: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    select:  {
      id: true, createdAt: true,
      facility: { select: { id: true, name: true, city: true, owner: { select: { user: { select: { name: true } } } } } },
    },
  });
  return Response.json({
    invites: invites.map((i) => ({
      id: i.id, sentAt: i.createdAt,
      facility: { id: i.facility.id, name: i.facility.name, city: i.facility.city },
      ownerName: i.facility.owner.user.name,
    })),
  });
}
