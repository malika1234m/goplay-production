import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Sports Categories ───────────────────────────────────────────
  const categories = await Promise.all([
    db.sportsCategory.upsert({ where: { name: "Cricket" },    update: {}, create: { name: "Cricket",    icon: "🏏" } }),
    db.sportsCategory.upsert({ where: { name: "Football" },   update: {}, create: { name: "Football",   icon: "⚽" } }),
    db.sportsCategory.upsert({ where: { name: "Basketball" }, update: {}, create: { name: "Basketball", icon: "🏀" } }),
    db.sportsCategory.upsert({ where: { name: "Tennis" },     update: {}, create: { name: "Tennis",     icon: "🎾" } }),
    db.sportsCategory.upsert({ where: { name: "Badminton" },  update: {}, create: { name: "Badminton",  icon: "🏸" } }),
    db.sportsCategory.upsert({ where: { name: "Volleyball" }, update: {}, create: { name: "Volleyball", icon: "🏐" } }),
  ]);
  console.log(`✅ ${categories.length} sports categories created`);

  // ─── Users ───────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await db.user.upsert({
    where: { email: "admin@goplay.lk" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@goplay.lk",
      password: hashedPassword,
      role: "ADMIN",
      phone: "+94771000001",
    },
  });

  const ownerUser = await db.user.upsert({
    where: { email: "owner@goplay.lk" },
    update: {},
    create: {
      name: "Ruwan Perera",
      email: "owner@goplay.lk",
      password: hashedPassword,
      role: "GROUND_OWNER",
      phone: "+94771000002",
    },
  });

  const playerUser = await db.user.upsert({
    where: { email: "player@goplay.lk" },
    update: {},
    create: {
      name: "Chamara Silva",
      email: "player@goplay.lk",
      password: hashedPassword,
      role: "USER",
      phone: "+94771000003",
    },
  });
  console.log("✅ 3 users created (admin, owner, player)");

  // ─── Ground Owner Profile ─────────────────────────────────────────
  const ownerProfile = await db.groundOwnerProfile.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      userId: ownerUser.id,
      businessName: "Perera Sports Facilities",
      phone: "+94771000002",
      address: "45 Sports Avenue",
      city: "Colombo",
      bio: "Premium sports facility management with 10+ years of experience.",
    },
  });
  console.log("✅ Ground owner profile created");

  // ─── Sports Facilities ────────────────────────────────────────────
  const cricket = categories.find((c) => c.name === "Cricket")!;
  const football = categories.find((c) => c.name === "Football")!;
  const badminton = categories.find((c) => c.name === "Badminton")!;
  const tennis = categories.find((c) => c.name === "Tennis")!;

  const grounds = await Promise.all([
    db.sportsFacility.create({
      data: {
        name: "Colombo Cricket Ground",
        description: "A premium cricket ground in the heart of Colombo featuring a well-maintained turf pitch, professional floodlights, and modern facilities.",
        address: "123 Sports Avenue, Colombo 03",
        city: "Colombo",
        hourlyRate: 2500,
        capacity: 22,
        amenities: ["Parking", "Changing Rooms", "Floodlights", "Restrooms", "Drinking Water", "First Aid"],
        images: [],
        status: "ACTIVE",
        categoryId: cricket.id,
        ownerId: ownerProfile.id,
      },
    }),
    db.sportsFacility.create({
      data: {
        name: "Galle Football Arena",
        description: "Full-size FIFA standard football pitch with natural grass, ideal for tournaments and training sessions.",
        address: "78 Marine Drive, Galle",
        city: "Galle",
        hourlyRate: 1800,
        capacity: 22,
        amenities: ["Parking", "Changing Rooms", "Restrooms", "Drinking Water"],
        images: [],
        status: "ACTIVE",
        categoryId: football.id,
        ownerId: ownerProfile.id,
      },
    }),
    db.sportsFacility.create({
      data: {
        name: "Kandy Badminton Hall",
        description: "Indoor air-conditioned badminton hall with 4 professional courts, ideal for competitive play and coaching.",
        address: "12 Peradeniya Road, Kandy",
        city: "Kandy",
        hourlyRate: 800,
        capacity: 8,
        amenities: ["AC", "Changing Rooms", "Restrooms", "Parking", "Coaching Available"],
        images: [],
        status: "ACTIVE",
        categoryId: badminton.id,
        ownerId: ownerProfile.id,
      },
    }),
    db.sportsFacility.create({
      data: {
        name: "Negombo Tennis Club",
        description: "Three professional hard-court tennis courts with evening floodlights, coaching services available.",
        address: "55 Beach Road, Negombo",
        city: "Negombo",
        hourlyRate: 1200,
        capacity: 4,
        amenities: ["Parking", "Floodlights", "Restrooms", "Coaching Available"],
        images: [],
        status: "ACTIVE",
        categoryId: tennis.id,
        ownerId: ownerProfile.id,
      },
    }),
  ]);
  console.log(`✅ ${grounds.length} facilities created`);

  // ─── Availability (Mon–Sun for each ground) ───────────────────────
  for (const ground of grounds) {
    await db.facilityAvailability.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        facilityId: ground.id,
        dayOfWeek: day,
        openTime: "06:00",
        closeTime: day === 0 || day === 6 ? "23:00" : "22:00",
        isOpen: true,
      })),
    });
  }
  console.log("✅ Availability set for all facilities (7 days/week)");

  // ─── Sample booking ───────────────────────────────────────────────
  await db.facilityBooking.create({
    data: {
      userId: playerUser.id,
      facilityId: grounds[0].id,
      bookingDate: new Date("2026-05-01"),
      startTime: "10:00",
      endTime: "12:00",
      totalHours: 2,
      totalAmount: 5000,
      status: "CONFIRMED",
      contactNumber: "+94771000003",
      specialRequests: "Need stumps and bat if available",
    },
  });
  console.log("✅ Sample booking created");

  console.log("\n🎉 Seeding complete!");
  console.log("─────────────────────────────────────────");
  console.log("Login credentials (all use password: password123)");
  console.log("  Admin        → admin@goplay.lk");
  console.log("  Ground Owner → owner@goplay.lk");
  console.log("  Player       → player@goplay.lk");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
