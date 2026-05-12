/**
 * Seed demo data for the Admin Cancellations Dashboard
 * Run: npx tsx scripts/seed-cancellation-demo.ts
 * Undo: npx tsx scripts/seed-cancellation-demo.ts --undo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db      = new PrismaClient({ adapter });

// ─── Real IDs from local DB ───────────────────────────────────────────────────
const USERS = {
  chamara:  { id: "cmoeigin30008t3yf6vc0kupk", name: "Chamara Silva" },
  malika:   { id: "cmoogqeh3002lksyfz5ujhr95", name: "Malika Nishnatha" },
  player1:  { id: "cmoo1hrg40000wkyfgmtmvo7d", name: "E2E Test User 1" },
  player2:  { id: "cmoo3uinv0006wkyfneiairv9", name: "E2E Test User 2" },
  player3:  { id: "cmoo3uloj000iwkyfbmeq2ica", name: "New Player" },
};

const FACILITIES = {
  colombo:  "cmoeigind000at3yfjrdzmy1c", // Colombo Cricket Ground
  galle:    "cmoeigine000bt3yf7mq13r7l", // Galle Football Arena
  kandy:    "cmoeiginf000ct3yfiu2sdal3", // Kandy Badminton Hall
  negombo:  "cmoeiginf000dt3yfej6ar3ho", // Negombo Tennis Club
};

const SEED_TAG = "DEMO_CANCEL_SEED"; // stored in cancelledBy to identify seed rows

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3_600_000); }
function hoursFromNow(n: number) { return new Date(Date.now() + n * 3_600_000); }

function timeStr(d: Date) { return d.toTimeString().slice(0, 5); }

async function seedBooking(opts: {
  userId: string;
  facilityId: string;
  status: "CANCELLED" | "NO_SHOW" | "CONFIRMED" | "COMPLETED";
  paymentMethod: "ONLINE" | "ON_ARRIVAL";
  paymentStatus?: "PAID" | "PENDING";
  totalAmount: number;
  bookingDate: Date;
  cancelledBy?: "user" | "owner";
  refundPercent?: number;
  refundAmount?: number;
  cancelledAt?: Date;
  noShowMarkedAt?: Date;
}) {
  const start = new Date(opts.bookingDate);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start); end.setHours(11, 0, 0, 0);

  return db.facilityBooking.create({
    data: {
      facilityId:    opts.facilityId,
      userId:        opts.userId,
      bookingDate:   opts.bookingDate,
      startTime:     timeStr(start),
      endTime:       timeStr(end),
      totalHours:    1,
      totalAmount:   opts.totalAmount,
      paymentMethod: opts.paymentMethod,
      paymentStatus: opts.paymentStatus ?? (opts.paymentMethod === "ONLINE" ? "PAID" : "PENDING"),
      status:        opts.status,
      cancelledBy:   opts.cancelledBy ?? null,
      refundPercent: opts.refundPercent ?? null,
      refundAmount:  opts.refundAmount ?? null,
      cancelledAt:   opts.cancelledAt ?? null,
      noShowMarkedAt: opts.noShowMarkedAt ?? null,
    },
  });
}

// ─── SEED ────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱  Seeding cancellation demo data...\n");

  // ── User 1: Chamara Silva — suspended (5 cash cancels) ───────────────────
  await db.user.update({
    where: { id: USERS.chamara.id },
    data:  { cashCancelCount: 5, noShowCount: 0, requiresOnlinePayment: false, isBookingSuspended: true },
  });
  // His 5 cancelled cash bookings
  for (let i = 0; i < 5; i++) {
    await seedBooking({
      userId: USERS.chamara.id, facilityId: FACILITIES.colombo,
      status: "CANCELLED", paymentMethod: "ON_ARRIVAL", totalAmount: 1200,
      bookingDate: daysAgo(30 - i * 4),
      cancelledBy: "user", refundPercent: 0, refundAmount: 0,
      cancelledAt: daysAgo(31 - i * 4),
    });
  }
  console.log("✅  Chamara Silva — suspended user (5 cash cancels, isBookingSuspended=true)");

  // ── User 2: Malika Nishnatha — online-only restricted (2 no-shows) ────────
  await db.user.update({
    where: { id: USERS.malika.id },
    data:  { noShowCount: 2, cashCancelCount: 0, requiresOnlinePayment: true, isBookingSuspended: false },
  });
  for (let i = 0; i < 2; i++) {
    await seedBooking({
      userId: USERS.malika.id, facilityId: FACILITIES.galle,
      status: "NO_SHOW", paymentMethod: "ON_ARRIVAL", totalAmount: 1500,
      bookingDate: daysAgo(14 - i * 7),
      noShowMarkedAt: hoursAgo(24 * (14 - i * 7)),
    });
  }
  console.log("✅  Malika Nishnatha — online-only restricted (2 no-shows, requiresOnlinePayment=true)");

  // ── User 3: E2E Test User 1 — 1 no-show (warning only) ───────────────────
  await db.user.update({
    where: { id: USERS.player1.id },
    data:  { noShowCount: 1, cashCancelCount: 0, requiresOnlinePayment: false, isBookingSuspended: false },
  });
  await seedBooking({
    userId: USERS.player1.id, facilityId: FACILITIES.kandy,
    status: "NO_SHOW", paymentMethod: "ON_ARRIVAL", totalAmount: 800,
    bookingDate: daysAgo(3),
    noShowMarkedAt: daysAgo(3),
  });
  console.log("✅  E2E Test User 1 — 1st no-show (warning stage)");

  // ── User 4: E2E Test User 2 — 3 cash cancels (warning, not banned yet) ───
  await db.user.update({
    where: { id: USERS.player2.id },
    data:  { cashCancelCount: 3, noShowCount: 0, requiresOnlinePayment: false, isBookingSuspended: false },
  });
  for (let i = 0; i < 3; i++) {
    await seedBooking({
      userId: USERS.player2.id, facilityId: FACILITIES.negombo,
      status: "CANCELLED", paymentMethod: "ON_ARRIVAL", totalAmount: 1000,
      bookingDate: daysAgo(20 - i * 5),
      cancelledBy: "user", refundPercent: 0, refundAmount: 0,
      cancelledAt: daysAgo(21 - i * 5),
    });
  }
  console.log("✅  E2E Test User 2 — 3 cash cancels (warning threshold reached)");

  // ── Facilities: strikes ───────────────────────────────────────────────────

  // Colombo Cricket Ground — 3 strikes → suspended
  await db.sportsFacility.update({
    where: { id: FACILITIES.colombo },
    data:  { cancelStrikeCount: 3, isListingSuspended: true, strikeResetAt: daysAgo(5) },
  });
  for (let i = 0; i < 3; i++) {
    await seedBooking({
      userId: USERS.player3.id, facilityId: FACILITIES.colombo,
      status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 2000,
      bookingDate: hoursFromNow(48 + i * 24),
      cancelledBy: "owner", refundPercent: 100, refundAmount: 2000,
      cancelledAt: daysAgo(4 - i),
    });
  }
  console.log("✅  Colombo Cricket Ground — 3 strikes, listing SUSPENDED");

  // Galle Football Arena — 2 strikes (close to suspension)
  await db.sportsFacility.update({
    where: { id: FACILITIES.galle },
    data:  { cancelStrikeCount: 2, isListingSuspended: false, strikeResetAt: daysAgo(10) },
  });
  for (let i = 0; i < 2; i++) {
    await seedBooking({
      userId: USERS.player1.id, facilityId: FACILITIES.galle,
      status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 1800,
      bookingDate: hoursFromNow(72 + i * 24),
      cancelledBy: "owner", refundPercent: 100, refundAmount: 1800,
      cancelledAt: daysAgo(9 - i),
    });
  }
  console.log("✅  Galle Football Arena — 2 strikes (1 away from suspension)");

  // Kandy Badminton Hall — 1 strike
  await db.sportsFacility.update({
    where: { id: FACILITIES.kandy },
    data:  { cancelStrikeCount: 1, isListingSuspended: false, strikeResetAt: daysAgo(15) },
  });
  await seedBooking({
    userId: USERS.player2.id, facilityId: FACILITIES.kandy,
    status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 1200,
    bookingDate: hoursFromNow(96),
    cancelledBy: "owner", refundPercent: 100, refundAmount: 1200,
    cancelledAt: daysAgo(14),
  });
  console.log("✅  Kandy Badminton Hall — 1 strike");

  // ── Mix of user-cancelled bookings with tiered refunds ───────────────────
  // 100% refund (cancelled 3 days before booking)
  await seedBooking({
    userId: USERS.player3.id, facilityId: FACILITIES.negombo,
    status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 1500,
    bookingDate: hoursFromNow(72),
    cancelledBy: "user", refundPercent: 100, refundAmount: 1500,
    cancelledAt: hoursAgo(2),
  });

  // 50% refund (cancelled 30h before)
  await seedBooking({
    userId: USERS.malika.id, facilityId: FACILITIES.kandy,
    status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 2000,
    bookingDate: hoursFromNow(30),
    cancelledBy: "user", refundPercent: 50, refundAmount: 1000,
    cancelledAt: hoursAgo(5),
  });

  // 25% refund (cancelled 10h before)
  await seedBooking({
    userId: USERS.player1.id, facilityId: FACILITIES.colombo,
    status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 1800,
    bookingDate: hoursFromNow(10),
    cancelledBy: "user", refundPercent: 25, refundAmount: 450,
    cancelledAt: hoursAgo(1),
  });

  // 0% refund (cancelled 1h before)
  await seedBooking({
    userId: USERS.player2.id, facilityId: FACILITIES.galle,
    status: "CANCELLED", paymentMethod: "ONLINE", totalAmount: 1200,
    bookingDate: hoursFromNow(1),
    cancelledBy: "user", refundPercent: 0, refundAmount: 0,
    cancelledAt: hoursAgo(0),
  });
  console.log("✅  4 user-cancelled online bookings (one per refund tier: 100%, 50%, 25%, 0%)");

  console.log("\n✨  Demo data seeded successfully!");
  console.log("\nWhat you'll see on the admin dashboard:");
  console.log("  Overview     → 2 suspended listings, 1 suspended user, 1 online-only user, multiple refunds needed");
  console.log("  No-Shows     → 3 entries: Malika (×2), E2E User 1 (×1)");
  console.log("  Owner Strikes→ Colombo (3 strikes, suspended), Galle (2 strikes), Kandy (1 strike)");
  console.log("  User Flags   → Chamara (suspended), Malika (online-only), E2E User 2 (3 cash cancels)");
  console.log("  All Cancels  → Full history with tiered refund amounts\n");
}

// ─── UNDO ────────────────────────────────────────────────────────────────────
async function undo() {
  console.log("🗑️   Removing demo data...\n");

  // Delete all bookings where cancelledBy is "user" or "owner" (seeded ones)
  // We identify them via the user IDs we seeded against
  const userIds = Object.values(USERS).map((u) => u.id);
  const deleted = await db.facilityBooking.deleteMany({
    where: {
      userId: { in: userIds },
      status: { in: ["CANCELLED", "NO_SHOW"] },
    },
  });
  console.log(`✅  Deleted ${deleted.count} seeded bookings`);

  // Reset user flags
  for (const u of Object.values(USERS)) {
    await db.user.update({
      where: { id: u.id },
      data:  { noShowCount: 0, cashCancelCount: 0, requiresOnlinePayment: false, isBookingSuspended: false },
    });
  }
  console.log("✅  Reset all user flags");

  // Reset facility strikes
  for (const fId of Object.values(FACILITIES)) {
    await db.sportsFacility.update({
      where: { id: fId },
      data:  { cancelStrikeCount: 0, isListingSuspended: false, strikeResetAt: null },
    });
  }
  console.log("✅  Reset all facility strikes\n");
  console.log("✨  Demo data removed.");
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const isUndo = process.argv.includes("--undo");
  if (isUndo) await undo();
  else        await seed();
  await db.$disconnect();
}

main().catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
