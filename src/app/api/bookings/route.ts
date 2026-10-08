import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { slotUsage, withFacilityDayLock } from "@/lib/slot-capacity";
import { slotInstant } from "@/lib/local-time";
import { getSession } from "@/lib/mobile-auth";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";
import { staleUnpaidBookingWhere } from "@/lib/payment-review";
import { getReceiptWindowMinutes } from "@/lib/settings";
import { bookablePaymentMethods } from "@/lib/payment-options";
import { sendSMS } from "@/lib/sms";
import { sendBookingReceivedEmail, sendNewBookingAlertEmail } from "@/lib/email";
import { isAllowed } from "@/lib/rateLimiter";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) {
      return Response.json({ error: "You must be logged in to book a ground." }, { status: 401 });
    }

    // 10 booking attempts per minute per player — mobile carriers put many players behind one shared IP, so a per-IP limit would block strangers
    if (!isAllowed(`book:${session.user.id}`, 10, 60_000)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    if (session.user.role === "GROUND_OWNER") {
      return Response.json({ error: "Ground owners cannot book sports grounds." }, { status: 403 });
    }

    const currentUser = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { isActive: true, isBookingSuspended: true },
    });
    if (!currentUser?.isActive) {
      return Response.json({ error: "Your account has been deactivated. Please contact support." }, { status: 403 });
    }
    // Repeated no-shows and cash cancellations suspend booking. Enforced here as well as on
    // joining an open match and cancelling — the app warns players this is what will happen.
    if (currentUser.isBookingSuspended) {
      return Response.json(
        { error: "Your account is suspended from booking. Please contact support." },
        { status: 403 }
      );
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

    const TIME_RE = /^\d{2}:\d{2}$/;
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return Response.json({ error: "Times must be in HH:MM format." }, { status: 400 });
    }
    const toMinsValidation = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    if (toMinsValidation(startTime) >= toMinsValidation(endTime)) {
      return Response.json({ error: "Start time must be before end time." }, { status: 400 });
    }
    if (specialRequests && specialRequests.length > 500) {
      return Response.json({ error: "Special requests must be under 500 characters." }, { status: 400 });
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

    // The ground decides how it takes payment; "Pay online" also needs a bank account to send to
    const paymentDetails = resolvePaymentDetails({ ...facility, owner: facility.owner });
    const methods = bookablePaymentMethods(facility.paymentOptions, paymentDetails !== null);
    if (paymentMethod === "ON_ARRIVAL" && !methods.cash) {
      return Response.json({ error: "This ground only takes online payment. Choose Pay online." }, { status: 400 });
    }
    if (paymentMethod === "ONLINE" && !methods.online) {
      return Response.json({
        error: facility.paymentOptions === "ON_ARRIVAL_ONLY"
          ? "This ground only takes payment at the ground."
          : "This ground has not set up online payments yet. Please choose Pay at Ground.",
      }, { status: 400 });
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

    // A slot that has already started cannot be booked. Compared as a real instant
    // so this holds on a UTC server as well as a Sri Lanka one.
    if (slotInstant(startOfDay, startTime).getTime() <= Date.now()) {
      return Response.json({ error: "That time has already passed. Please pick a later slot." }, { status: 400 });
    }


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
    // Pure arithmetic — hoisted so it is available after the transaction too
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const totalHours  = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const totalAmount = totalHours * facility.hourlyRate;

    // Release unpaid "Pay online" holds for this slot before checking conflicts
    const expiryCutoff = new Date(Date.now() - (await getReceiptWindowMinutes()) * 60 * 1000);

    // Everything from here to the insert runs under one facility-day lock, so a
    // concurrent request cannot slip a booking in between the check and the write.
    const outcome = await withFacilityDayLock(facilityId, startOfDay, async (tx) => {
    await tx.facilityBooking.updateMany({
      where: {
        facilityId,
        ...(courtId ? { courtId } : {}),
        bookingDate:   { gte: startOfDay, lte: endOfDay },
        ...staleUnpaidBookingWhere(expiryCutoff),
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
      data: { status: "CANCELLED" },
    });

    const conflict = await tx.facilityBooking.findFirst({
      where: {
        facilityId,
        ...(courtId ? { courtId } : {}),
        bookingDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ["CONFIRMED", "PENDING"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    });
    if (conflict) return { ok: false as const, status: 409, body: { error: "This time slot is already booked. Please choose another." } };

    // A lobby holds a court without naming one, so it only blocks this booking
    // once the facility has no court left — not merely because it overlaps.
    const usage = await slotUsage({ facilityId, date: startOfDay, startTime, endTime, client: tx });
    if (usage.free <= 0 && usage.lobby) {
      return { ok: false as const, status: 409, body: {
        error:   `This slot has an active ${usage.lobby.categoryName} open match lobby and no free court left. Join the lobby instead!`,
        lobbyId: usage.lobby.id,
      } };
    }
    if (usage.free <= 0) {
      return { ok: false as const, status: 409, body: { error: "This time slot is already booked. Please choose another." } };
    }

    const created = await tx.facilityBooking.create({
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

      return { ok: true as const, booking: created };
    });

    if (!outcome.ok) return Response.json(outcome.body, { status: outcome.status });
    const booking = outcome.booking;

    const courtLabel = booking.court ? ` — ${booking.court.name}` : "";

    // Notification
    await createNotification({
      userId:  session.user.id,
      title:   "Booking Received",
      message: `Your booking at ${booking.facility.name}${courtLabel} on ${bookingDate} from ${startTime} to ${endTime} is pending confirmation.`,
      type:    "info",
    });

    // Online bookings: the owner hears again (with email) once the receipt is uploaded
    await createNotification({
      userId:  facility.owner.user.id,
      title:   "New Booking Received",
      message: paymentMethod === "ONLINE"
        ? `${session.user.name ?? "A player"} has booked ${facility.name}${courtLabel} on ${bookingDate} from ${startTime} to ${endTime}. Payment: bank transfer (Rs. ${totalAmount.toLocaleString()}) — receipt to follow.`
        : `${session.user.name ?? "A player"} has booked ${facility.name}${courtLabel} on ${bookingDate} from ${startTime} to ${endTime}. Payment: Cash on Arrival (Rs. ${totalAmount.toLocaleString()}).`,
      type:    "info",
    });

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

    if (paymentMethod === "ONLINE") {
      const receiptWindowMinutes = await getReceiptWindowMinutes();
      return Response.json({
        booking,
        paymentDetails,
        receiptWindowMinutes,
        message: "Booking created. Transfer the amount to the ground's bank account and upload the receipt.",
      }, { status: 201 });
    }

    return Response.json({ booking, message: "Booking created. Pay at the ground." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bookings]", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
