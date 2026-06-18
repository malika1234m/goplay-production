import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// 6°54′28″N  79°51′57″E
const LAT = 6 + 54 / 60 + 28 / 3600;   // 6.9078°
const LNG = 79 + 51 / 60 + 57 / 3600;  // 79.8658°

async function wipe() {
  console.log("🗑️  Wiping all data…");
  await db.facilityReviewReply.deleteMany();
  await db.facilityReview.deleteMany();
  await db.groundEarning.deleteMany();
  // MERGE CONFLICT NOTE (subscription-plans): ownerSubscription.deleteMany() goes here too
  await db.openMatchSpot.deleteMany();
  await db.openMatch.deleteMany();
  await db.facilityBooking.deleteMany();
  await db.blockedDate.deleteMany();
  await db.facilityCourt.deleteMany();
  await db.facilityAvailability.deleteMany();
  await db.facilityWorker.deleteMany();
  await db.sportsFacility.deleteMany();
  await db.payout.deleteMany();
  await db.groundOwnerProfile.deleteMany();
  await db.providerApplication.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.notification.deleteMany();
  await db.user.deleteMany();
  await db.sportsCategory.deleteMany();
  await db.platformSetting.deleteMany();
  console.log("✅ Database wiped");
}

function dayStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

async function main() {
  await wipe();

  // ── Sports categories ──────────────────────────────────────────────
  // minPlayers drives Open Match lobby size requirements
  const [football, cricket, basketball, badminton, tennis, volleyball] =
    await Promise.all([
      db.sportsCategory.create({ data: { name: "Football",         icon: "⚽", minPlayers: 15, maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Cricket",          icon: "🏏", minPlayers: 10, maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Basketball",       icon: "🏀", minPlayers: 6,  maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Badminton",        icon: "🏸", minPlayers: 2,  maxPlayers: 4,    allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Tennis",           icon: "🎾", minPlayers: 2,  maxPlayers: 4,    allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Volleyball",       icon: "🏐", minPlayers: 6,  maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Futsal",           icon: "🥅", minPlayers: 10, maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Netball",          icon: "🏐", minPlayers: 6,  maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Rugby",            icon: "🏉", minPlayers: 12, maxPlayers: null, allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Swimming",         icon: "🏊", minPlayers: 1,  maxPlayers: null, allowOpenMatch: false } }),
      db.sportsCategory.create({ data: { name: "Table Tennis",     icon: "🏓", minPlayers: 2,  maxPlayers: 4,    allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Pickleball",       icon: "🏓", minPlayers: 2,  maxPlayers: 4,    allowOpenMatch: true  } }),
      db.sportsCategory.create({ data: { name: "Billiards & Pool", icon: "🎱", minPlayers: 4,  maxPlayers: null, allowOpenMatch: true  } }),
    ]);
  console.log("✅ 6 sports categories created");
  void [cricket, basketball, badminton, tennis, volleyball];

  // ── Passwords ──────────────────────────────────────────────────────
  const adminPass  = await bcrypt.hash("GoPlay@Admin2025!", 10);
  const ownerPass  = await bcrypt.hash("Owner@GoPlay25",   10);
  const workerPass = await bcrypt.hash("Worker@GoPlay25",  10);
  const playerPass = await bcrypt.hash("Player@GoPlay25",  10);

  // ── Admin ──────────────────────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      name:              "Malika Nishnatha",
      email:             "malikanishnatha4@gmail.com",
      password:          adminPass,
      role:              "ADMIN",
      mustChangePassword: true,
    },
  });

  // ── GoPlay System Account (Open Match bookings are placed under this user) ──
  await db.user.create({
    data: {
      name:            "GoPlay System",
      email:           "system@goplay.lk",
      password:        await bcrypt.hash(crypto.randomUUID(), 10),
      role:            "ADMIN",
      isSystemAccount: true,
      isActive:        true,
    },
  });
  console.log("✅ GoPlay system account created");

  // ── Ground Owner ───────────────────────────────────────────────────
  const ownerUser = await db.user.create({
    data: {
      name:     "Kavinda Bandara",
      email:    "owner@goplay.lk",
      password: ownerPass,
      role:     "GROUND_OWNER",
      phone:    "+94711234567",
    },
  });

  const ownerProfile = await db.groundOwnerProfile.create({
    data: {
      userId:       ownerUser.id,
      businessName: "GoPlay Sports Facilities",
      phone:        "+94711234567",
      address:      "Colombo 05",
      city:         "Colombo",
      bio:          "Managing premium sports facilities across Colombo.",
    },
  });

  // ── Worker ─────────────────────────────────────────────────────────
  const workerUser = await db.user.create({
    data: {
      name:     "Thisara Jayawickrama",
      email:    "worker@goplay.lk",
      password: workerPass,
      role:     "GROUND_WORKER",
      phone:    "+94719876543",
    },
  });

  // ── Demo players ───────────────────────────────────────────────────
  const [player1, player2, player3] = await Promise.all([
    db.user.create({ data: { name: "Ashan Fernando",  email: "ashan@demo.lk",  password: playerPass, role: "USER", phone: "+94771234501" } }),
    db.user.create({ data: { name: "Nimal Perera",    email: "nimal@demo.lk",  password: playerPass, role: "USER", phone: "+94771234502" } }),
    db.user.create({ data: { name: "Priya Kumara",    email: "priya@demo.lk",  password: playerPass, role: "USER", phone: "+94771234503" } }),
  ]);

  console.log("✅ 6 users created (admin, owner, worker, 3 players)");
  void admin;

  // ── Demo facility ──────────────────────────────────────────────────
  const facility = await db.sportsFacility.create({
    data: {
      name: "GoPlay Sports Complex",
      description:
        "GoPlay Sports Complex is a premium multi-purpose sports facility in the heart of Colombo. " +
        "Featuring three professionally maintained grounds equipped with floodlights, " +
        "this venue is ideal for football, cricket, and casual matches. " +
        "The complex includes modern changing rooms, ample parking, a cafeteria, and 24/7 security " +
        "making it the top choice for players and teams across Western Province.",
      address:    "Sports Complex Road, Colombo 05",
      city:       "Colombo",
      hourlyRate: 3000,
      capacity:   50,
      latitude:   LAT,
      longitude:  LNG,
      amenities: [
        "Parking",
        "Floodlights",
        "Changing Rooms",
        "Restrooms",
        "Cafeteria",
        "Drinking Water",
        "First Aid Kit",
        "CCTV Security",
        "Wi-Fi",
      ],
      images:    [],
      status:    "ACTIVE",
      categories: { connect: [{ id: football.id }] },
      ownerId:    ownerProfile.id,
    },
  });
  console.log(`✅ Demo facility created — id: ${facility.id}`);

  // ── Courts ─────────────────────────────────────────────────────────
  const [courtA, courtB, courtC] = await Promise.all([
    db.facilityCourt.create({
      data: {
        facilityId:  facility.id,
        name:        "Ground A",
        description: "Full-size natural-grass football pitch with floodlights. Seats up to 22 players.",
        sortOrder:   0,
        isActive:    true,
      },
    }),
    db.facilityCourt.create({
      data: {
        facilityId:  facility.id,
        name:        "Ground B",
        description: "Half-size all-purpose turf ground. Ideal for 5-a-side, throwball, and training sessions.",
        sortOrder:   1,
        isActive:    true,
      },
    }),
    db.facilityCourt.create({
      data: {
        facilityId:  facility.id,
        name:        "Ground C",
        description: "Indoor synthetic court suitable for basketball and volleyball. Air-conditioned.",
        sortOrder:   2,
        isActive:    true,
      },
    }),
  ]);
  console.log("✅ 3 courts created (Ground A, B, C)");

  // ── Availability ───────────────────────────────────────────────────
  await db.facilityAvailability.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      facilityId: facility.id,
      dayOfWeek:  dow,
      isOpen:     true,
      openTime:   "06:00",
      closeTime:  dow === 0 || dow === 6 ? "23:00" : "22:00",
    })),
  });
  console.log("✅ Availability set — Mon–Fri 06:00–22:00 · Sat–Sun 06:00–23:00");

  // ── Worker assigned ────────────────────────────────────────────────
  await db.facilityWorker.create({
    data: { userId: workerUser.id, facilityId: facility.id, addedBy: ownerUser.id },
  });
  console.log("✅ Worker assigned to facility");

  // ── Sample bookings ────────────────────────────────────────────────
  const today     = dayStart(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow  = addDays(today, 1);
  const dayAfter  = addDays(today, 2);

  const bookingResults = await db.facilityBooking.createManyAndReturn({
    data: [
      // TODAY — CONFIRMED (cash)
      {
        userId:        player1.id,
        facilityId:    facility.id,
        courtId:       courtA.id,
        bookingDate:   today,
        startTime:     "08:00",
        endTime:       "09:00",
        totalHours:    1,
        totalAmount:   3000,
        status:        "CONFIRMED",
        paymentMethod: "ON_ARRIVAL",
        paymentStatus: "PENDING",
      },
      // TODAY — PENDING (online)
      {
        userId:        player2.id,
        facilityId:    facility.id,
        courtId:       courtB.id,
        bookingDate:   today,
        startTime:     "10:00",
        endTime:       "12:00",
        totalHours:    2,
        totalAmount:   6000,
        status:        "PENDING",
        paymentMethod: "ONLINE",
        paymentStatus: "PAID",
      },
      // TODAY — CONFIRMED (online)
      {
        userId:        player3.id,
        facilityId:    facility.id,
        courtId:       courtC.id,
        bookingDate:   today,
        startTime:     "15:00",
        endTime:       "17:00",
        totalHours:    2,
        totalAmount:   6000,
        status:        "CONFIRMED",
        paymentMethod: "ONLINE",
        paymentStatus: "PAID",
      },
      // YESTERDAY — COMPLETED
      {
        userId:        player1.id,
        facilityId:    facility.id,
        courtId:       courtA.id,
        bookingDate:   yesterday,
        startTime:     "09:00",
        endTime:       "11:00",
        totalHours:    2,
        totalAmount:   6000,
        status:        "COMPLETED",
        paymentMethod: "ON_ARRIVAL",
        paymentStatus: "PAID",
      },
      // YESTERDAY — CANCELLED
      {
        userId:        player2.id,
        facilityId:    facility.id,
        courtId:       courtB.id,
        bookingDate:   yesterday,
        startTime:     "14:00",
        endTime:       "15:00",
        totalHours:    1,
        totalAmount:   3000,
        status:        "CANCELLED",
        paymentMethod: "ONLINE",
        paymentStatus: "REFUNDED",
      },
      // TOMORROW — PENDING
      {
        userId:        player3.id,
        facilityId:    facility.id,
        courtId:       courtA.id,
        bookingDate:   tomorrow,
        startTime:     "07:00",
        endTime:       "09:00",
        totalHours:    2,
        totalAmount:   6000,
        status:        "PENDING",
        paymentMethod: "ONLINE",
        paymentStatus: "PAID",
      },
      // DAY AFTER TOMORROW — CONFIRMED
      {
        userId:        player1.id,
        facilityId:    facility.id,
        courtId:       courtC.id,
        bookingDate:   dayAfter,
        startTime:     "11:00",
        endTime:       "13:00",
        totalHours:    2,
        totalAmount:   6000,
        status:        "CONFIRMED",
        paymentMethod: "ONLINE",
        paymentStatus: "PAID",
      },
      // Walk-in by worker
      {
        userId:          workerUser.id,
        facilityId:      facility.id,
        courtId:         courtB.id,
        bookingDate:     today,
        startTime:       "13:00",
        endTime:         "14:00",
        totalHours:      1,
        totalAmount:     3000,
        status:          "CONFIRMED",
        paymentMethod:   "ON_ARRIVAL",
        paymentStatus:   "PENDING",
        specialRequests: "[Walk-in] Ranjith Silva — Phone: 077-9876543",
        contactNumber:   "0779876543",
      },
    ],
  });
  console.log("✅ 8 sample bookings created (today, yesterday, tomorrow, walk-in)");

  // ── Sample reviews — use completed booking IDs ─────────────────────
  const completedBooking = bookingResults.find(
    (b) => b.status === "COMPLETED" && b.userId === player1.id
  );
  if (completedBooking) {
    await db.facilityReview.createMany({
      data: [
        {
          userId:     player1.id,
          facilityId: facility.id,
          bookingId:  completedBooking.id,
          rating:     5,
          reviewText: "Excellent facility! Grounds are well-maintained and the staff is very helpful.",
        },
      ],
    });
    console.log("✅ 1 sample review created");
  }

  // ── Notifications ──────────────────────────────────────────────────
  await db.notification.createMany({
    data: [
      {
        userId:  ownerUser.id,
        type:    "BOOKING_CONFIRMED",
        title:   "New Booking Confirmed",
        message: "Ashan Fernando has confirmed a booking for Ground A on today at 08:00.",
        isRead:  false,
      },
      {
        userId:  ownerUser.id,
        type:    "NEW_REVIEW",
        title:   "New Review Received",
        message: "You received a 5-star review from Ashan Fernando. Keep up the great work!",
        isRead:  false,
      },
      {
        userId:  ownerUser.id,
        type:    "PAYMENT_RECEIVED",
        title:   "Payment Received",
        message: "LKR 6,000 payment received for Nimal Perera's booking on Ground B.",
        isRead:  true,
      },
      {
        userId:  workerUser.id,
        type:    "BOOKING_CONFIRMED",
        title:   "Booking Assigned",
        message: "A new booking has been made at GoPlay Sports Complex. Check your schedule.",
        isRead:  false,
      },
    ],
  });
  console.log("✅ 4 notifications created");

  // ── Open Match sample lobbies (all tied to the demo facility) ──────
  const omDay2 = addDays(dayStart(new Date()), 2);
  const omDay4 = addDays(dayStart(new Date()), 4);
  const omDay6 = addDays(dayStart(new Date()), 6);
  const omDay8 = addDays(dayStart(new Date()), 8);

  const [catFootball, catBadminton, catCricket, catBasketball] = await Promise.all([
    db.sportsCategory.findUnique({ where: { name: "Football"   } }),
    db.sportsCategory.findUnique({ where: { name: "Badminton"  } }),
    db.sportsCategory.findUnique({ where: { name: "Cricket"    } }),
    db.sportsCategory.findUnique({ where: { name: "Basketball" } }),
  ]);

  // 1. Badminton lobby — Ashan needs 1 partner, at the demo facility
  const badmintonLobby = await db.openMatch.create({
    data: {
      facilityId:         facility.id,
      categoryId:         catBadminton!.id,
      preferredDate:      omDay2,
      preferredStartTime: "08:00",
      preferredEndTime:   "10:00",
      totalSpotsNeeded:   2,
      spotsReserved:      1,
      status:             "COLLECTING",
      serviceFeePct:      18,
      expiresAt:          addDays(new Date(), 2),
    },
  });
  await db.openMatchSpot.create({
    data: { matchId: badmintonLobby.id, userId: player1.id, groupSize: 1, status: "RESERVED", paymentStatus: "PENDING", amountPaid: 0 },
  });

  // 2. Football lobby — two groups joined, 8 spots left
  const footballLobby = await db.openMatch.create({
    data: {
      facilityId:         facility.id,
      categoryId:         catFootball!.id,
      preferredDate:      omDay4,
      preferredStartTime: "16:00",
      preferredEndTime:   "18:00",
      totalSpotsNeeded:   22,
      spotsReserved:      14,
      status:             "COLLECTING",
      serviceFeePct:      18,
      expiresAt:          addDays(new Date(), 3),
    },
  });
  await db.openMatchSpot.createMany({
    data: [
      { matchId: footballLobby.id, userId: player2.id, groupSize: 6, status: "RESERVED", paymentStatus: "PENDING", amountPaid: 0 },
      { matchId: footballLobby.id, userId: player3.id, groupSize: 8, status: "RESERVED", paymentStatus: "PENDING", amountPaid: 0 },
    ],
  });

  // 3. Basketball — fully MATCHED, booking created at demo facility
  const basketballBooking = await db.facilityBooking.create({
    data: {
      userId: workerUser.id, facilityId: facility.id,
      bookingDate: omDay6, startTime: "10:00", endTime: "12:00",
      totalHours: 2, totalAmount: 6000, status: "CONFIRMED",
      paymentMethod: "ONLINE", paymentStatus: "PAID",
      isOpenMatch: true, contactNumber: "N/A",
    },
  });
  const basketballLobby = await db.openMatch.create({
    data: {
      facilityId:         facility.id,
      categoryId:         catBasketball!.id,
      preferredDate:      omDay6,
      preferredStartTime: "10:00",
      preferredEndTime:   "12:00",
      totalSpotsNeeded:   10,
      spotsReserved:      10,
      status:             "MATCHED",
      matchBookingId:     basketballBooking.id,
      serviceFeePct:      18,
      matchedAt:          new Date(),
      expiresAt:          addDays(new Date(), 1),
    },
  });
  await db.facilityBooking.update({ where: { id: basketballBooking.id }, data: { openMatchId: basketballLobby.id } });
  await db.openMatchSpot.createMany({
    data: [
      { matchId: basketballLobby.id, userId: player1.id, groupSize: 5, status: "CONFIRMED", paymentStatus: "PAID", amountPaid: 3360 },
      { matchId: basketballLobby.id, userId: player2.id, groupSize: 5, status: "CONFIRMED", paymentStatus: "PAID", amountPaid: 3360 },
    ],
  });

  // 4. Cricket — Priya's group of 6, needs 16 more players
  const cricketLobby = await db.openMatch.create({
    data: {
      facilityId:         facility.id,
      categoryId:         catCricket!.id,
      preferredDate:      omDay8,
      preferredStartTime: "09:00",
      preferredEndTime:   "14:00",
      totalSpotsNeeded:   22,
      spotsReserved:      6,
      status:             "COLLECTING",
      serviceFeePct:      18,
      expiresAt:          addDays(new Date(), 5),
    },
  });
  await db.openMatchSpot.create({
    data: { matchId: cricketLobby.id, userId: player3.id, groupSize: 6, status: "RESERVED", paymentStatus: "PENDING", amountPaid: 0 },
  });

  console.log("✅ 4 sample open match lobbies created — all at GoPlay Sports Complex");
  void [badmintonLobby, footballLobby, cricketLobby];

  // ── Platform settings ──────────────────────────────────────────────
  await db.platformSetting.createMany({
    data: [
      { key: "commission_pct",       value: "10" },
      { key: "min_payout_amount",    value: "1000" },
      { key: "payout_cooldown_days", value: "7" },
    ],
  });
  console.log("✅ Platform settings seeded");

  console.log("\n🎉 Seeding complete!\n");
  console.log("════════════════════════════════════════");
  console.log("  ADMIN   → malikanishnatha4@gmail.com");
  console.log("  Pass    → GoPlay@Admin2025!  (change on first login)");
  console.log("────────────────────────────────────────");
  console.log("  OWNER   → owner@goplay.lk");
  console.log("  Pass    → Owner@GoPlay25");
  console.log("────────────────────────────────────────");
  console.log("  WORKER  → worker@goplay.lk");
  console.log("  Pass    → Worker@GoPlay25");
  console.log("════════════════════════════════════════");
  console.log(`  Facility ID → ${facility.id}`);
  console.log(`  Location    → ${LAT.toFixed(6)}°N  ${LNG.toFixed(6)}°E`);
  console.log("════════════════════════════════════════\n");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
