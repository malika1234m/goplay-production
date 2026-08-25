import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

// GET /api/open-matches/[id] — lobby detail
// Players see co-player contact info only after they have a RESERVED/CONFIRMED spot
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(req);

  const match = await db.openMatch.findUnique({
    where: { id },
    include: {
      facility: { select: { id: true, name: true, address: true, city: true, images: true, hourlyRate: true, latitude: true, longitude: true, capacity: true } },
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      spots: {
        where:  { status: { in: ["RESERVED", "CONFIRMED", "CANCELLED", "REFUNDED"] } },
        select: {
          id: true, groupSize: true, status: true, paymentStatus: true, createdAt: true,
          user: { select: { id: true, name: true, avatar: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!match) return Response.json({ error: "Lobby not found." }, { status: 404 });

  // Hide contact details (phone/email) for users who haven't paid into this lobby
  const currentUserId = session?.user?.id;
  const isParticipant = match.spots.some(
    (s) => s.user.id === currentUserId && ["RESERVED", "CONFIRMED"].includes(s.status),
  );

  const spotsForResponse = match.spots.map((s) => ({
    ...s,
    user: isParticipant
      ? s.user
      : { id: s.user.id, name: s.user.name, avatar: s.user.avatar, phone: null, email: null },
  }));

  return Response.json({ ...match, spots: spotsForResponse });
}
