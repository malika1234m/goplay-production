import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildPayHereHash, PAYHERE_MERCHANT_ID, PAYHERE_CHECKOUT_URL } from "@/lib/payhere";
import { sendSMS } from "@/lib/sms";
import { sendBookingReceivedEmail, sendNewBookingAlertEmail } from "@/lib/email";
import { isAllowed, getClientIp } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    // 10 booking attempts per minute per IP
    if (!isAllowed(`book:${getClientIp(req)}`, 10, 60_000)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "You must be logged in to book a ground." }, { status: 401 });
    }
    if (session.user.role === "GROUND_OWNER") {
      return Response.json({ error: "Ground owners cannot book sports grounds." }, { status: 403 });
    }

    const currentUser = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { isActive: true },
    });
    if (!currentUser?.isActive) {
      return Response.json({ error: "Your account has been deactivated. Please contact support." }, { status: 403 });
    }

    const {
      facilityId,
      courtId,
      bookingDate,
      startTime,
      endTime,
      contactNumber,
      specialRequests,
      paymentMethod = "ON_ARRIVAL",
    } = await req.json();

    if (!facilityId || !bookingDate || !startTime || !endTime) {
      return Response.json({ error: "facilityId, bookingDate, startTime and endTime are required." }, { status: 400 });
    }

    const maxAdvance = new Date();
    maxAdvance.setUTCHours(0, 0, 0, 0);
    maxAdvance.setDate(maxAdvance.getDate() + 60);
    const requestedDate = new Date(bookingDate);
    requestedDate.setUTCHours(0, 0, 0, 0);
    if (requestedDate > maxAdvance) {
      return Response.json({ error: "Bookings can only be made up to 60 days in advance." }, { status: 400 });
    }
    if (!contactNumber?.trim()) {
      return Response.json({ error: "Contact number is required." }, { status: 400 });
    }
    const cleanedPhone = contactNumber.replace(/[\s\-().]/g, "");
    if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleanedPhone)) {
      return Response.json({ error: "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567 or +94 77 123 4567)." }, { status: 400 });
    }

    if (!["ONLINE", "ON_ARRIVAL"].includes(paymentMethod)) {
      return Response.json({ error: "Invalid paymentMethod." }, { status: 400 });
    }

    const facility = await db.sportsFacility.findUnique({
      where: { id: facilityId, status: "ACTIVE" },
      include: {
        owner:  { include: { user: { select: { id: true, name: true, email: true } } } },
        courts: { where: { isActive: true }, select: { id: true } },
      },
    });
    if (!facility) {
      return Response.json({ error: "Facility not found or not available." }, { status: 404 });
    }

    // Validate courtId when the facility has courts defined
    if (facility.courts.length > 0) {
      if (!courtId) {
        return Response.json({ error: "Please select a court to book." }, { status: 400 });
      }
      const validCourt = facility.courts.find((c) => c.id === courtId);
      if (!validCourt) {
        return Response.json({ error: "Selected court is not available." }, { status: 400 });
      }
    }

    // Normalize to UTC midnight so date comparisons are timezone-safe
    const startOfDay = new Date(bookingDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const blockedEntries = await db.blockedDate.findMany({
      where: { facilityId, date: { gte: startOfDay, lte: endOfDay } },
    });

    const fullDayBlock = blockedEntries.find((b) => !b.startTime || !b.endTime);
    if (fullDayBlock) {
      return Response.json({
        error: fullDayBlock.reason
          ? `This date is not available: ${fullDayBlock.reason}`
          : "This date has been blocked by the facility.",
      }, { status: 409 });
    }

    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const partialBlock = blockedEntries.find(
      (b) => b.startTime && b.endTime &&
             toMins(b.startTime) < toMins(endTime) &&
             toMins(b.endTime)   > toMins(startTime)
    );
    if (partialBlock) {
      return Response.json({
        error: partialBlock.reason
          ? `This time slot is blocked: ${partialBlock.reason}`
          : "This time slot has been blocked for maintenance.",
      }, { status: 409 });
    }
    // Release expired unpaid online bookings for this slot before checking conflicts
    const expiryCutoff = new Date(Date.now() - 30 * 60 * 1000);
    await db.facilityBooking.updateMany({
      where: {
        facilityId,
        ...(courtId ? { courtId } : {}),
        bookingDate:   { gte: startOfDay, lte: endOfDay },
        status:        "PENDING",
        paymentMethod: "ONLINE",
        paymentStatus: "PENDING",
        createdAt:     { lt: expiryCutoff },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
      data: { status: "CANCELLED" },
    });

    const conflict = await db.facilityBooking.findFirst({
      where: {
        facilityId,
        ...(courtId ? { courtId } : {}),
        bookingDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ["CONFIRMED", "PENDING"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    });
    if (conflict) {
      return Response.json({ error: "This time slot is already booked. Please choose another." }, { status: 409 });
    }

    // Calculate total
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const totalHours  = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const totalAmount = totalHours * facility.hourlyRate;

    const booking = await db.facilityBooking.create({
      data: {
        userId:          session.user.id,
        facilityId,
        courtId:         courtId || null,
        bookingDate:     startOfDay,
        startTime,
        endTime,
        totalHours,
        totalAmount,
        status:          "PENDING",
        paymentMethod,
        paymentStatus:   "PENDING",
        contactNumber:   contactNumber  || null,
        specialRequests: specialRequests || null,
      },
      include: {
        facility: { select: { name: true } },
        court:    { select: { name: true } },
      },
    });

    const courtLabel = booking.court ? ` — ${booking.court.name}` : "";

    // Notification
    await db.notification.create({
      data: {
        userId:  session.user.id,
        title:   "Booking Received",
        message: `Your booking at ${booking.facility.name}${courtLabel} on ${bookingDate} from ${startTime} to ${endTime} is pending confirmation.`,
        type:    "info",
      },
    });

    // Notify ground owner of new cash booking (online bookings notify owner via PayHere webhook)
    if (paymentMethod === "ON_ARRIVAL") {
      await db.notification.create({
        data: {
          userId:  facility.owner.user.id,
          title:   "New Booking Received",
          message: `${session.user.name ?? "A player"} has booked ${facility.name}${courtLabel} on ${bookingDate} from ${startTime} to ${endTime}. Payment: Cash on Arrival (Rs. ${totalAmount.toLocaleString()}).`,
          type:    "info",
        },
      });
    }

    // SMS: booking received
    if (contactNumber) {
      await sendSMS(
        contactNumber,
        `GoPlay: Your booking at ${facility.name} on ${bookingDate} from ${startTime} to ${endTime} has been received. Awaiting confirmation from the ground owner.`
      );
    }

    // Email notifications (fire-and-forget — won't fail the booking if email errors)
    const dateLabel = new Date(bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    const emailOpts = {
      facilityName:  facility.name,
      date:          dateLabel,
      startTime,
      endTime,
      totalAmount,
      paymentMethod,
      bookingId:     booking.id,
    };
    void sendBookingReceivedEmail({
      to:   session.user.email ?? "",
      name: session.user.name ?? "Player",
      ...emailOpts,
    });
    void sendNewBookingAlertEmail({
      to:         facility.owner.user.email ?? "",
      ownerName:  facility.owner.user.name  ?? "Owner",
      playerName: session.user.name ?? "A player",
      ...emailOpts,
    });

    // ── Online payment: return PayHere params for client-side checkout ──
    if (paymentMethod === "ONLINE") {
      const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const orderId = booking.id;
      const hash    = buildPayHereHash(orderId, totalAmount);
      const user    = session.user;

      const payHereParams = {
        merchant_id:  PAYHERE_MERCHANT_ID,
        return_url:   `${appUrl}/booking-success?bookingId=${booking.id}`,
        cancel_url:   `${appUrl}/booking-cancelled?bookingId=${booking.id}`,
        notify_url:   `${appUrl}/api/payhere/notify`,
        order_id:     orderId,
        items:        `Booking at ${facility.name} on ${bookingDate} ${startTime}-${endTime}`,
        currency:     "LKR",
        amount:       totalAmount.toFixed(2),
        first_name:   (user.name ?? "").split(" ")[0] || "Customer",
        last_name:    (user.name ?? "").split(" ").slice(1).join(" ") || "-",
        email:        user.email ?? "",
        phone:        contactNumber || "0771234567",
        address:      facility.address,
        city:         facility.city,
        country:      "Sri Lanka",
        hash,
        checkout_url: PAYHERE_CHECKOUT_URL,
      };

      return Response.json({ booking, payHereParams }, { status: 201 });
    }

    return Response.json({ booking, message: "Booking created. Pay at the ground." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bookings]", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
