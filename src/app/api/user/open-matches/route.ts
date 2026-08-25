import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

// GET /api/user/open-matches — authenticated player's lobby history
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

  const spots = await db.openMatchSpot.findMany({
    where: { userId: session.user.id },
    include: {
      match: {
        include: {
          category: { select: { id: true, name: true, icon: true } },
          facility: { select: { id: true, name: true, address: true, city: true } },
          spots: {
            where:  { status: { in: ["RESERVED", "CONFIRMED"] } },
            select: { id: true, groupSize: true,
                      user: { select: { id: true, name: true, avatar: true, phone: true, email: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(spots);
}
