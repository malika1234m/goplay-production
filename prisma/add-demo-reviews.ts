import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // ── Get the demo facility ──────────────────────────────────────────
  const facility = await db.sportsFacility.findFirst({
    where: { name: "GoPlay Sports Complex" },
  });
  if (!facility) throw new Error("Demo facility not found. Run seed first.");

  // ── Update description ─────────────────────────────────────────────
  await db.sportsFacility.update({
    where: { id: facility.id },
    data: {
      description:
        "This is a demo ground. " +
        "GoPlay Sports Complex is a premium multi-purpose sports facility in the heart of Colombo. " +
        "Featuring three professionally maintained grounds equipped with floodlights, " +
        "this venue is ideal for football, cricket, and casual matches. " +
        "The complex includes modern changing rooms, ample parking, a cafeteria, and 24/7 security " +
        "making it the top choice for players and teams across Western Province.",
    },
  });
  console.log("✅ Description updated");

  // ── Get the first court ────────────────────────────────────────────
  const court = await db.facilityCourt.findFirst({
    where: { facilityId: facility.id },
  });

  // ── Create 2 demo player accounts ─────────────────────────────────
  const pass = await bcrypt.hash("DemoPlayer25", 10);

  const [player1, player2] = await Promise.all([
    db.user.upsert({
      where:  { email: "player1@demo.goplay.lk" },
      update: {},
      create: {
        name:     "Ashan Perera",
        email:    "player1@demo.goplay.lk",
        password: pass,
        role:     "USER",
        phone:    "+94771234001",
      },
    }),
    db.user.upsert({
      where:  { email: "player2@demo.goplay.lk" },
      update: {},
      create: {
        name:     "Nimali Fernando",
        email:    "player2@demo.goplay.lk",
        password: pass,
        role:     "USER",
        phone:    "+94771234002",
      },
    }),
  ]);
  console.log("✅ 2 demo players created");

  // ── Create 2 completed bookings (past dates) ───────────────────────
  const booking1 = await db.facilityBooking.create({
    data: {
      userId:        player1.id,
      facilityId:    facility.id,
      courtId:       court?.id ?? null,
      bookingDate:   new Date("2025-04-20T00:00:00.000Z"),
      startTime:     "08:00",
      endTime:       "10:00",
      totalHours:    2,
      totalAmount:   6000,
      status:        "COMPLETED",
      paymentMethod: "ON_ARRIVAL",
      paymentStatus: "PAID",
    },
  });

  const booking2 = await db.facilityBooking.create({
    data: {
      userId:        player2.id,
      facilityId:    facility.id,
      courtId:       court?.id ?? null,
      bookingDate:   new Date("2025-04-27T00:00:00.000Z"),
      startTime:     "16:00",
      endTime:       "18:00",
      totalHours:    2,
      totalAmount:   6000,
      status:        "COMPLETED",
      paymentMethod: "ON_ARRIVAL",
      paymentStatus: "PAID",
    },
  });
  console.log("✅ 2 demo bookings created");

  // ── Create 2 reviews ───────────────────────────────────────────────
  await db.facilityReview.createMany({
    data: [
      {
        userId:     player1.id,
        facilityId: facility.id,
        bookingId:  booking1.id,
        rating:     5,
        reviewText:
          "Excellent facility! The grounds are well maintained and the floodlights made the evening session perfect. " +
          "Booking through GoPlay was super easy — took less than 2 minutes. Highly recommend!",
      },
      {
        userId:     player2.id,
        facilityId: facility.id,
        bookingId:  booking2.id,
        rating:     4,
        reviewText:
          "Great experience overall. The changing rooms were clean and the staff was friendly. " +
          "Parking is spacious too. Will definitely book again for our next match.",
      },
    ],
  });
  console.log("✅ 2 demo reviews created");

  console.log("\n🎉 Done!\n");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
