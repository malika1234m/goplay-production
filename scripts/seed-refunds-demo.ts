/**
 * Seed demo data for the Admin Refunds Dashboard
 * Run:  npx tsx scripts/seed-refunds-demo.ts
 * Undo: npx tsx scripts/seed-refunds-demo.ts --undo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db      = new PrismaClient({ adapter });

const SEED_TAG = "REFUND_DEMO_SEED";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function findUsersAndFacilities() {
  const users = await db.user.findMany({
    where: { role: "USER" },
    select: { id: true, name: true },
    take: 5,
  });
  const facilities = await db.sportsFacility.findMany({
    where:  { status: "ACTIVE" },
    select: {
      id: true, name: true,
      owner: { select: { user: { select: { id: true } } } },
    },
    take: 3,
  });
  return { users, facilities };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Seeding refund demo data…\n");

  // Upsert default policy tiers into PlatformSetting
  await db.platformSetting.upsert({
    where:  { key: "refund_policy" },
    update: {},
    create: {
      key:   "refund_policy",
      value: JSON.stringify([
        { minHours: 48, refundPercent: 100 },
        { minHours: 24, refundPercent: 50  },
        { minHours: 4,  refundPercent: 25  },
        { minHours: 0,  refundPercent: 0   },
      ]),
    },
  });
  console.log("✅  Refund policy saved to PlatformSetting");

  const { users, facilities } = await findUsersAndFacilities();

  if (users.length === 0 || facilities.length === 0) {
    console.error("❌  No users or approved facilities found. Seed the main data first.");
    process.exit(1);
  }

  const u0 = users[0];
  const u1 = users[1] ?? users[0];
  const u2 = users[2] ?? users[0];
  const u3 = users[3] ?? users[1] ?? users[0];
  const f0  = facilities[0];
  const f1  = facilities[1] ?? facilities[0];
  const f2  = facilities[2] ?? facilities[0];

  const bookings = [
    // ── ONLINE — Tier 1: 100% refund, NEEDED ─────────────────────────────────
    {
      userId:        u0.id,
      facilityId:    f0.id,
      bookingDate:   daysAgo(2),
      startTime:     "09:00",
      endTime:       "10:00",
      totalHours:    1,
      totalAmount:   2500,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NEEDED" as const,
      refundPercent: 100,
      refundAmount:  2500,
      cancelledAt:   daysAgo(5),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    {
      userId:        u1.id,
      facilityId:    f1.id,
      bookingDate:   daysAgo(1),
      startTime:     "14:00",
      endTime:       "16:00",
      totalHours:    2,
      totalAmount:   4800,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NEEDED" as const,
      refundPercent: 100,
      refundAmount:  4800,
      cancelledAt:   daysAgo(4),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    // ── ONLINE — Tier 2: 50% refund, NEEDED ──────────────────────────────────
    {
      userId:        u2.id,
      facilityId:    f0.id,
      bookingDate:   daysAgo(1),
      startTime:     "11:00",
      endTime:       "12:00",
      totalHours:    1,
      totalAmount:   3000,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NEEDED" as const,
      refundPercent: 50,
      refundAmount:  1500,
      cancelledAt:   daysAgo(2),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    {
      userId:        u3.id,
      facilityId:    f2.id,
      bookingDate:   daysAgo(1),
      startTime:     "17:00",
      endTime:       "18:00",
      totalHours:    1,
      totalAmount:   2200,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NEEDED" as const,
      refundPercent: 50,
      refundAmount:  1100,
      cancelledAt:   daysAgo(2),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    // ── ONLINE — Tier 3: 25% refund, NEEDED ──────────────────────────────────
    {
      userId:        u0.id,
      facilityId:    f1.id,
      bookingDate:   daysAgo(1),
      startTime:     "08:00",
      endTime:       "09:00",
      totalHours:    1,
      totalAmount:   1800,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NEEDED" as const,
      refundPercent: 25,
      refundAmount:  450,
      cancelledAt:   daysAgo(1),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    // ── ONLINE — Tier 4: 0% refund, no refund needed ─────────────────────────
    {
      userId:        u1.id,
      facilityId:    f2.id,
      bookingDate:   daysAgo(1),
      startTime:     "20:00",
      endTime:       "21:00",
      totalHours:    1,
      totalAmount:   2000,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "PAID" as const,
      refundStatus:  "NONE" as const,
      refundPercent: 0,
      refundAmount:  0,
      cancelledAt:   daysAgo(1),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    // ── ONLINE — Already PROCESSED (refunded) ────────────────────────────────
    {
      userId:        u2.id,
      facilityId:    f0.id,
      bookingDate:   daysAgo(10),
      startTime:     "10:00",
      endTime:       "12:00",
      totalHours:    2,
      totalAmount:   5000,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "REFUNDED" as const,
      refundStatus:  "PROCESSED" as const,
      refundPercent: 100,
      refundAmount:  5000,
      refundNote:    "Processed via PayHere ref #TXN-9182",
      refundProcessedAt: daysAgo(9),
      cancelledAt:   daysAgo(12),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    {
      userId:        u3.id,
      facilityId:    f1.id,
      bookingDate:   daysAgo(7),
      startTime:     "15:00",
      endTime:       "16:00",
      totalHours:    1,
      totalAmount:   3500,
      status:        "CANCELLED" as const,
      paymentMethod: "ONLINE" as const,
      paymentStatus: "REFUNDED" as const,
      refundStatus:  "PROCESSED" as const,
      refundPercent: 50,
      refundAmount:  1750,
      refundNote:    "Processed via PayHere ref #TXN-7730",
      refundProcessedAt: daysAgo(6),
      cancelledAt:   daysAgo(8),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    // ── CASH — No refund needed ───────────────────────────────────────────────
    {
      userId:        u0.id,
      facilityId:    f2.id,
      bookingDate:   daysAgo(3),
      startTime:     "09:00",
      endTime:       "10:00",
      totalHours:    1,
      totalAmount:   1500,
      status:        "CANCELLED" as const,
      paymentMethod: "ON_ARRIVAL" as const,
      paymentStatus: "PENDING" as const,
      refundStatus:  "NONE" as const,
      cancelledAt:   daysAgo(4),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    {
      userId:        u1.id,
      facilityId:    f0.id,
      bookingDate:   daysAgo(5),
      startTime:     "16:00",
      endTime:       "17:00",
      totalHours:    1,
      totalAmount:   1200,
      status:        "CANCELLED" as const,
      paymentMethod: "ON_ARRIVAL" as const,
      paymentStatus: "PENDING" as const,
      refundStatus:  "NONE" as const,
      cancelledAt:   daysAgo(6),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
    {
      userId:        u2.id,
      facilityId:    f1.id,
      bookingDate:   daysAgo(2),
      startTime:     "13:00",
      endTime:       "14:00",
      totalHours:    1,
      totalAmount:   1800,
      status:        "CANCELLED" as const,
      paymentMethod: "ON_ARRIVAL" as const,
      paymentStatus: "PENDING" as const,
      refundStatus:  "NONE" as const,
      cancelledAt:   daysAgo(3),
      cancelledBy:   "user",
      specialRequests: SEED_TAG,
    },
  ];

  let created = 0;
  for (const b of bookings) {
    await db.facilityBooking.create({ data: b });
    created++;
  }

  console.log(`✅  Created ${created} demo cancelled bookings\n`);
  console.log("Demo breakdown:");
  console.log("  Online — 100% refund (NEEDED) : 2");
  console.log("  Online — 50%  refund (NEEDED) : 2");
  console.log("  Online — 25%  refund (NEEDED) : 1");
  console.log("  Online — 0%   refund (NONE)   : 1");
  console.log("  Online — Already PROCESSED    : 2");
  console.log("  Cash   — No refund            : 3");
  console.log("\nVisit /admin/refunds to see the dashboard.");
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

async function undo() {
  console.log("🗑️  Removing refund demo data…");
  const { count } = await db.facilityBooking.deleteMany({
    where: { specialRequests: SEED_TAG },
  });
  console.log(`✅  Deleted ${count} demo bookings`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const isUndo = process.argv.includes("--undo");

(isUndo ? undo() : seed())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
