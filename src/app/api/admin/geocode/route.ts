import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";

// GET — list all facilities with their geo status
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const facilities = await db.sportsFacility.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, address: true, city: true, latitude: true, longitude: true },
    orderBy: { name: "asc" },
  });

  return Response.json({ facilities });
}

// POST — geocode a single facility by id, or all missing ones
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { facilityId, all } = await req.json();

  if (all) {
    const missing = await db.sportsFacility.findMany({
      where: { status: "ACTIVE", OR: [{ latitude: null }, { longitude: null }] },
      select: { id: true, address: true, city: true, name: true },
    });

    const results: { id: string; name: string; success: boolean; lat?: number; lng?: number }[] = [];

    for (const f of missing) {
      // Rate-limit: 1 req/sec for Nominatim
      await new Promise((r) => setTimeout(r, 1100));
      const geo = await geocodeAddress(f.address, f.city);
      if (geo) {
        await db.sportsFacility.update({
          where: { id: f.id },
          data: { latitude: geo.lat, longitude: geo.lng },
        });
        results.push({ id: f.id, name: f.name, success: true, lat: geo.lat, lng: geo.lng });
      } else {
        results.push({ id: f.id, name: f.name, success: false });
      }
    }

    return Response.json({ results });
  }

  if (facilityId) {
    const facility = await db.sportsFacility.findUnique({
      where: { id: facilityId },
      select: { id: true, name: true, address: true, city: true },
    });
    if (!facility) return Response.json({ error: "Facility not found." }, { status: 404 });

    const geo = await geocodeAddress(facility.address, facility.city);
    if (!geo) return Response.json({ error: "Could not geocode this address." }, { status: 422 });

    await db.sportsFacility.update({
      where: { id: facilityId },
      data: { latitude: geo.lat, longitude: geo.lng },
    });

    return Response.json({ success: true, lat: geo.lat, lng: geo.lng });
  }

  return Response.json({ error: "Provide facilityId or all:true" }, { status: 400 });
}

// PATCH — manually set lat/lng for a facility
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { facilityId, latitude, longitude } = await req.json();
  if (!facilityId || latitude == null || longitude == null) {
    return Response.json({ error: "facilityId, latitude, longitude required." }, { status: 400 });
  }

  await db.sportsFacility.update({
    where: { id: facilityId },
    data: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
  });

  return Response.json({ success: true });
}
