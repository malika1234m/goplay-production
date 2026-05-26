import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { isAllowed, getClientIp } from "@/lib/rateLimiter";
import { sendWelcomeEmail } from "@/lib/email";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    if (!isAllowed(`mobile-apply:${getClientIp(req)}`, 3, 60 * 60_000)) {
      return Response.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const {
      name, email, password, phone,
      address, city,
      facilityName, facilityAddress, facilityCity,
      categoryIds, proposedHourlyRate,
      capacity, amenities, facilityDescription,
    } = await req.json();

    // ── Account validation ──────────────────────────────────────────────────
    if (!name?.trim() || !email?.trim() || !password || !phone?.trim()) {
      return Response.json({ error: "Name, email, phone and password are required." }, { status: 400 });
    }
    if (name.trim().length < 2 || name.trim().length > 50) {
      return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return Response.json({ error: "Password must be at least 8 characters with a letter and a number." }, { status: 400 });
    }
    const cleanedPhone = phone.replace(/[\s\-().+]/g, "");
    if (!/^(?:94|0)7[0-9]{8}$/.test(cleanedPhone)) {
      return Response.json({ error: "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)." }, { status: 400 });
    }

    // ── Personal info validation ────────────────────────────────────────────
    if (!address?.trim() || address.trim().length < 5) {
      return Response.json({ error: "Please enter a valid address (at least 5 characters)." }, { status: 400 });
    }
    if (!city?.trim() || city.trim().length < 2) {
      return Response.json({ error: "Please enter a valid city name." }, { status: 400 });
    }

    // ── Facility validation ─────────────────────────────────────────────────
    if (!facilityName?.trim()) {
      return Response.json({ error: "Facility name is required." }, { status: 400 });
    }
    if (!facilityAddress?.trim()) {
      return Response.json({ error: "Facility address is required." }, { status: 400 });
    }
    if (!facilityCity?.trim()) {
      return Response.json({ error: "Facility city is required." }, { status: 400 });
    }
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return Response.json({ error: "At least one sport category is required." }, { status: 400 });
    }
    if (!proposedHourlyRate || Number(proposedHourlyRate) < 1) {
      return Response.json({ error: "Please enter a valid hourly rate." }, { status: 400 });
    }

    // ── Check duplicate email ───────────────────────────────────────────────
    const existing = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        phone: phone.trim(),
        role:  "USER",
      },
    });

    await db.providerApplication.create({
      data: {
        userId:             user.id,
        phone:              phone.trim(),
        address:            address.trim(),
        city:               city.trim(),
        facilityName:       facilityName.trim(),
        facilityAddress:    facilityAddress.trim(),
        facilityCity:       facilityCity.trim(),
        categoryIds,
        proposedHourlyRate: Number(proposedHourlyRate),
        capacity:           capacity ? Number(capacity) : null,
        amenities:          Array.isArray(amenities) ? amenities : [],
        facilityDescription: facilityDescription?.trim() || null,
      },
    });

    await createNotification({
      userId:  user.id,
      title:   "Application Submitted",
      message: "Your provider application has been submitted and is awaiting admin review. We'll notify you by email once it's reviewed.",
      type:    "info",
    });

    void sendWelcomeEmail(user.email, user.name ?? "there");

    return Response.json({ message: "Application submitted successfully." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/mobile-apply]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
