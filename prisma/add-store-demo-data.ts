/**
 * Populates the local database with presentable demo content for Play Store
 * screenshots: facility photos, ratings/reviews, and a booking history for the
 * signed-in demo player. Safe to re-run — every write is keyed and idempotent.
 *
 *   npx tsx --env-file=.env prisma/add-store-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// The Android emulator reaches the dev server on the host at 10.0.2.2.
const HOST = process.env.DEMO_ASSET_HOST ?? "http://10.0.2.2:3000";

const PHOTOS: Record<string, string[]> = {
  "Kandy Hills Tennis Club": ["tennis-1.jpg", "tennis-2.jpg"],
  "Ace Badminton Courts":    ["badminton-1.jpg", "badminton-2.jpg"],
  "Riverside Futsal Arena":  ["futsal-1.jpg", "futsal-2.jpg"],
  "GoPlay Sports Complex":   ["complex-1.jpg", "complex-2.jpg"],
};

const REVIEWS: { email: string; rating: number; text: string }[] = [
  { email: "ashan@demo.lk", rating: 5, text: "Courts were in great shape and the floodlights make evening games easy. Booking took under a minute." },
  { email: "nimal@demo.lk", rating: 4, text: "Good surface and plenty of parking. Turned up and the slot was ready, no waiting around." },
  { email: "priya@demo.lk", rating: 5, text: "Clean changing rooms and the staff were helpful. We split an open match here and it worked perfectly." },
];

function at(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // Booking dates are stored as UTC midnight of the calendar day —
  // setHours() would write the server's local midnight instead.
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  // ── 1. Facility photos + clean descriptions ────────────────────────
  for (const [name, files] of Object.entries(PHOTOS)) {
    const facility = await db.sportsFacility.findFirst({ where: { name } });
    if (!facility) { console.warn(`  skip (not found): ${name}`); continue; }

    await db.sportsFacility.update({
      where: { id: facility.id },
      data: {
        images: files.map((f) => `${HOST}/demo/${f}`),
        // Strip the seed marker so it doesn't show up in screenshots
        description: facility.description?.replace(/^\[demo-seed\]\s*/, "") ?? null,
      },
    });
    console.log(`  photos → ${name}`);
  }

  // ── 2. Ratings, via a completed booking per reviewer ───────────────
  const facilities = await db.sportsFacility.findMany({
    where: { name: { in: Object.keys(PHOTOS) } },
    include: { courts: { take: 1 } },
  });

  for (const facility of facilities) {
    for (const [i, r] of REVIEWS.entries()) {
      const user = await db.user.findUnique({ where: { email: r.email } });
      if (!user) continue;

      const existing = await db.facilityReview.findFirst({
        where: { userId: user.id, facilityId: facility.id },
      });
      if (existing) continue;

      const hours = 1;
      const booking = await db.facilityBooking.create({
        data: {
          userId:        user.id,
          facilityId:    facility.id,
          courtId:       facility.courts[0]?.id ?? null,
          bookingDate:   at(-(7 + i * 5)),
          startTime:     `${17 + i}:00`,
          endTime:       `${18 + i}:00`,
          totalHours:    hours,
          totalAmount:   facility.hourlyRate * hours,
          status:        "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: "ON_ARRIVAL",
          contactNumber: "0771234567",
        },
      });

      await db.facilityReview.create({
        data: {
          userId:     user.id,
          facilityId: facility.id,
          bookingId:  booking.id,
          rating:     r.rating,
          reviewText: r.text,
          createdAt:  at(-(6 + i * 5)),
        },
      });
    }
    console.log(`  reviews → ${facility.name}`);
  }

  // ── 3. Booking history for the demo player ─────────────────────────
  const player = await db.user.findUnique({ where: { email: process.env.DEMO_PLAYER_EMAIL ?? "rashmi@gmail.com" } });
  if (!player) {
    console.warn("  demo player not found — skipping booking history");
  } else {
    const plan = [
      { facility: "Kandy Hills Tennis Club", day:  2, start: "08:00", end: "09:00", status: "CONFIRMED" as const },
      { facility: "Ace Badminton Courts",    day:  5, start: "19:00", end: "20:00", status: "CONFIRMED" as const },
      { facility: "Riverside Futsal Arena",  day: -6, start: "18:00", end: "19:00", status: "COMPLETED" as const },
      { facility: "GoPlay Sports Complex",   day: -13, start: "07:00", end: "08:00", status: "COMPLETED" as const },
    ];

    for (const p of plan) {
      const facility = facilities.find((f) => f.name === p.facility);
      if (!facility) continue;

      const dupe = await db.facilityBooking.findFirst({
        where: { userId: player.id, facilityId: facility.id, bookingDate: at(p.day) },
      });
      if (dupe) continue;

      await db.facilityBooking.create({
        data: {
          userId:        player.id,
          facilityId:    facility.id,
          courtId:       facility.courts[0]?.id ?? null,
          bookingDate:   at(p.day),
          startTime:     p.start,
          endTime:       p.end,
          totalHours:    1,
          totalAmount:   facility.hourlyRate,
          status:        p.status,
          paymentStatus: p.status === "COMPLETED" ? "PAID" : "PENDING",
          paymentMethod: "ON_ARRIVAL",
          contactNumber: "0775481108",
        },
      });
      console.log(`  booking → ${p.facility} (${p.status})`);
    }
  }

  const [reviews, bookings] = await Promise.all([
    db.facilityReview.count(),
    db.facilityBooking.count(),
  ]);
  console.log(`\ndone — ${reviews} reviews, ${bookings} bookings total`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
