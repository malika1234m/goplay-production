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
  // Delete leaf → root to respect FK constraints
  await db.facilityReviewReply.deleteMany();
  await db.facilityReview.deleteMany();
  await db.groundEarning.deleteMany();
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

async function main() {
  await wipe();

  // ── Sports categories ──────────────────────────────────────────────
  const [football, cricket, basketball, badminton, tennis, volleyball] =
    await Promise.all([
      db.sportsCategory.create({ data: { name: "Football",   icon: "⚽" } }),
      db.sportsCategory.create({ data: { name: "Cricket",    icon: "🏏" } }),
      db.sportsCategory.create({ data: { name: "Basketball", icon: "🏀" } }),
      db.sportsCategory.create({ data: { name: "Badminton",  icon: "🏸" } }),
      db.sportsCategory.create({ data: { name: "Tennis",     icon: "🎾" } }),
      db.sportsCategory.create({ data: { name: "Volleyball", icon: "🏐" } }),
    ]);
  console.log("✅ 6 sports categories created");
  void [cricket, basketball, badminton, tennis, volleyball]; // suppress unused warning

  // ── Passwords ──────────────────────────────────────────────────────
  const adminPass  = await bcrypt.hash("GoPlay@Admin2025!", 10);
  const ownerPass  = await bcrypt.hash("Owner@GoPlay25",   10);
  const workerPass = await bcrypt.hash("Worker@GoPlay25",  10);

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

  console.log("✅ 3 users created (admin, owner, worker)");
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
      images:    [],   // owner will add real photos via Cloudinary
      status:    "ACTIVE",
      categoryId: football.id,
      ownerId:    ownerProfile.id,
    },
  });
  console.log(`✅ Demo facility created — id: ${facility.id}`);

  // ── Courts ─────────────────────────────────────────────────────────
  await db.facilityCourt.createMany({
    data: [
      {
        facilityId:  facility.id,
        name:        "Ground A",
        description: "Full-size natural-grass football pitch with floodlights. Seats up to 22 players.",
        sortOrder:   0,
        isActive:    true,
      },
      {
        facilityId:  facility.id,
        name:        "Ground B",
        description: "Half-size all-purpose turf ground. Ideal for 5-a-side, throwball, and training sessions.",
        sortOrder:   1,
        isActive:    true,
      },
      {
        facilityId:  facility.id,
        name:        "Ground C",
        description: "Indoor synthetic court suitable for basketball and volleyball. Air-conditioned.",
        sortOrder:   2,
        isActive:    true,
      },
    ],
  });
  console.log("✅ 3 courts created (Ground A, B, C)");

  // ── Availability — open every day ──────────────────────────────────
  await db.facilityAvailability.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      facilityId: facility.id,
      dayOfWeek:  dow,
      isOpen:     true,
      openTime:   "06:00",
      closeTime:  dow === 0 || dow === 6 ? "23:00" : "22:00", // weekends close later
    })),
  });
  console.log("✅ Availability set — Mon–Fri 06:00–22:00 · Sat–Sun 06:00–23:00");

  // ── Assign worker to facility ──────────────────────────────────────
  await db.facilityWorker.create({
    data: { userId: workerUser.id, facilityId: facility.id, addedBy: ownerUser.id },
  });
  console.log("✅ Worker assigned to facility");

  // ── Platform settings ──────────────────────────────────────────────
  await db.platformSetting.createMany({
    data: [
      { key: "commission_pct",    value: "10" },
      { key: "min_payout_amount", value: "1000" },
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
