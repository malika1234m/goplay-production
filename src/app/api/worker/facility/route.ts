import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "GROUND_WORKER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignment = await db.facilityWorker.findUnique({
    where: { userId: session.user.id },
    include: {
      facility: {
        include: {
          categories:   { select: { name: true } },
          availability: { orderBy: { dayOfWeek: "asc" } },
          owner:        { include: { user: { select: { name: true, email: true } } } },
          courts:       { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } },
        },
      },
    },
  });

  if (!assignment) {
    return Response.json({ error: "No facility assignment found." }, { status: 404 });
  }

  const f = assignment.facility;

  return Response.json({
    facility: {
      id:           f.id,
      name:         f.name,
      address:      f.address,
      city:         f.city,
      hourlyRate:   f.hourlyRate,
      categories:   f.categories.map((c: { name: string }) => c.name),
      ownerName:    f.owner.user.name,
      courts:       f.courts.map((c) => ({ id: c.id, name: c.name })),
      availability: f.availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        isOpen:    a.isOpen,
        openTime:  a.openTime,
        closeTime: a.closeTime,
      })),
    },
  });
}
