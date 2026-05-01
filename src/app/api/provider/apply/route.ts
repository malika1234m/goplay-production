import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "You must be logged in." }, { status: 401 });
    if (session.user.role !== "USER") return Response.json({ error: "Only regular users can apply to become a provider." }, { status: 403 });

    // Block if already has a pending application
    const existing = await db.providerApplication.findFirst({
      where: { userId: session.user.id, status: "PENDING" },
    });
    if (existing) return Response.json({ error: "You already have a pending application." }, { status: 409 });

    const {
      phone, address, city,
      facilityName, facilityAddress, facilityCity, categoryId,
      proposedHourlyRate, capacity, amenities, facilityDescription,
    } = await req.json();

    if (!phone || !address || !city || !facilityName || !facilityAddress || !facilityCity || !categoryId || !proposedHourlyRate) {
      return Response.json({ error: "All required fields must be filled." }, { status: 400 });
    }

    const application = await db.providerApplication.create({
      data: {
        userId:             session.user.id,
        phone:              phone.trim(),
        address:            address.trim(),
        city:               city.trim(),
        facilityName:       facilityName.trim(),
        facilityAddress:    facilityAddress.trim(),
        facilityCity:       facilityCity.trim(),
        categoryId,
        proposedHourlyRate: Number(proposedHourlyRate),
        capacity:           capacity ? Number(capacity) : null,
        amenities:          amenities ?? [],
        facilityDescription: facilityDescription?.trim() || null,
      },
    });

    // Notify the user
    await db.notification.create({
      data: {
        userId:  session.user.id,
        title:   "Application Submitted",
        message: "Your provider application has been submitted and is awaiting admin review. We'll notify you once it's reviewed.",
        type:    "info",
      },
    });

    return Response.json({ application, message: "Application submitted successfully." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/provider/apply]", err);
    return Response.json({ error: "Failed to submit application." }, { status: 500 });
  }
}
