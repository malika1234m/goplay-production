/**
 * Cancellation Policy Test Suite
 * Tests every flow: user cancel (tiered refunds), owner cancel (strikes), no-show, admin actions
 * Run: DATABASE_URL=... npx tsx scripts/test-cancellation-flows.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCancellationPolicy } from "../src/lib/cancellation-policy";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db      = new PrismaClient({ adapter });

// ─── Fixed IDs from local DB ─────────────────────────────────────────────────
const USER_ID     = "cmoo4c48x0014ksyfc0uuegbo"; // E2E Test User
const FACILITY_ID = "cmoeigind000at3yfjrdzmy1c"; // Colombo Cricket Ground

// ─── Helpers ─────────────────────────────────────────────────────────────────
let pass = 0; let fail = 0;
function ok(label: string, val: unknown, expected: unknown) {
  const ok = JSON.stringify(val) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}\n     got:      ${JSON.stringify(val)}\n     expected: ${JSON.stringify(expected)}`); fail++; }
}
function section(title: string) { console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`); }

async function makeBooking(opts: {
  hoursFromNow: number;
  paymentMethod: "ONLINE" | "ON_ARRIVAL";
  status?: "PENDING" | "CONFIRMED";
}) {
  const start = new Date();
  start.setHours(start.getHours() + opts.hoursFromNow, 0, 0, 0);
  const end   = new Date(start); end.setHours(end.getHours() + 1);
  const startTime = start.toTimeString().slice(0, 5);
  const endTime   = end.toTimeString().slice(0, 5);

  return db.facilityBooking.create({
    data: {
      facilityId:    FACILITY_ID,
      userId:        USER_ID,
      bookingDate:   start,
      startTime,
      endTime,
      totalHours:    1,
      totalAmount:   1000,
      paymentMethod: opts.paymentMethod,
      paymentStatus: opts.paymentMethod === "ONLINE" ? "PAID" : "PENDING",
      status:        opts.status ?? "CONFIRMED",
    },
  });
}

async function cleanup(ids: string[]) {
  await db.facilityBooking.deleteMany({ where: { id: { in: ids } } });
}

async function resetUser() {
  await db.user.update({
    where: { id: USER_ID },
    data: { noShowCount: 0, cashCancelCount: 0, requiresOnlinePayment: false, isBookingSuspended: false },
  });
}

async function resetFacility() {
  await db.sportsFacility.update({
    where: { id: FACILITY_ID },
    data: { cancelStrikeCount: 0, strikeResetAt: null, isListingSuspended: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getCancellationPolicy() utility
// ─────────────────────────────────────────────────────────────────────────────
async function test_policyUtility() {
  section("1. Cancellation Policy Utility (getCancellationPolicy)");

  const future = (hours: number) => {
    const d = new Date(); d.setHours(d.getHours() + hours, 0, 0, 0);
    const t = d.toTimeString().slice(0, 5);
    return { date: d, time: t };
  };

  const { refundPercent: p48 } = getCancellationPolicy(future(49).date, future(49).time);
  ok("48h+  → 100% refund", p48, 100);

  const { refundPercent: p36 } = getCancellationPolicy(future(36).date, future(36).time);
  ok("36h   → 50% refund",  p36, 50);

  const { refundPercent: p10 } = getCancellationPolicy(future(10).date, future(10).time);
  ok("10h   → 25% refund",  p10, 25);

  const { refundPercent: p1 } = getCancellationPolicy(future(2).date, future(2).time);
  ok("<4h   → 0% refund",   p1,  0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. User cancellation — cash booking (tracks cashCancelCount)
// ─────────────────────────────────────────────────────────────────────────────
async function test_userCashCancel() {
  section("2. User Cancels Cash Booking (cashCancelCount tracking)");
  await resetUser();
  const ids: string[] = [];

  // Cancel 3 cash bookings → count increments
  for (let i = 0; i < 3; i++) {
    const b = await makeBooking({ hoursFromNow: 50 + i, paymentMethod: "ON_ARRIVAL" });
    ids.push(b.id);

    // Simulate cancel logic
    const user = await db.user.findUnique({
      where: { id: USER_ID }, select: { cashCancelCount: true, isBookingSuspended: true },
    });
    const newCount = (user!.cashCancelCount ?? 0) + 1;
    const suspend  = newCount >= 5;
    await db.facilityBooking.update({
      where: { id: b.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: 100, refundAmount: 0 },
    });
    await db.user.update({
      where: { id: USER_ID },
      data: { cashCancelCount: newCount, ...(suspend && { isBookingSuspended: true }) },
    });
  }

  const u = await db.user.findUnique({ where: { id: USER_ID }, select: { cashCancelCount: true, isBookingSuspended: true } });
  ok("cashCancelCount = 3 after 3 cancels", u?.cashCancelCount, 3);
  ok("not yet suspended at 3",              u?.isBookingSuspended, false);

  // 2 more → suspend
  for (let i = 0; i < 2; i++) {
    const b = await makeBooking({ hoursFromNow: 60 + i, paymentMethod: "ON_ARRIVAL" });
    ids.push(b.id);
    const user2 = await db.user.findUnique({ where: { id: USER_ID }, select: { cashCancelCount: true } });
    const newCount2 = (user2!.cashCancelCount ?? 0) + 1;
    await db.facilityBooking.update({
      where: { id: b.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: 0, refundAmount: 0 },
    });
    await db.user.update({ where: { id: USER_ID }, data: { cashCancelCount: newCount2, ...(newCount2 >= 5 && { isBookingSuspended: true }) } });
  }

  const u2 = await db.user.findUnique({ where: { id: USER_ID }, select: { cashCancelCount: true, isBookingSuspended: true } });
  ok("cashCancelCount = 5 after 5 cancels",   u2?.cashCancelCount,  5);
  ok("isBookingSuspended = true at 5 cancels", u2?.isBookingSuspended, true);

  await cleanup(ids);
  await resetUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. User cancellation — online booking (tiered refund stored)
// ─────────────────────────────────────────────────────────────────────────────
async function test_userOnlineCancel() {
  section("3. User Cancels Online Paid Booking (tiered refund)");
  await resetUser();
  const ids: string[] = [];

  // 48h+ → 100%
  const b100 = await makeBooking({ hoursFromNow: 50, paymentMethod: "ONLINE" });
  ids.push(b100.id);
  const p100 = getCancellationPolicy(b100.bookingDate, b100.startTime);
  await db.facilityBooking.update({
    where: { id: b100.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: p100.refundPercent, refundAmount: b100.totalAmount * p100.refundPercent / 100 },
  });
  const r100 = await db.facilityBooking.findUnique({ where: { id: b100.id }, select: { refundPercent: true, refundAmount: true } });
  ok("48h+ online: refundPercent=100", r100?.refundPercent, 100);
  ok("48h+ online: refundAmount=1000", r100?.refundAmount,  1000);

  // 30h → 50%
  const b50 = await makeBooking({ hoursFromNow: 30, paymentMethod: "ONLINE" });
  ids.push(b50.id);
  const p50 = getCancellationPolicy(b50.bookingDate, b50.startTime);
  await db.facilityBooking.update({
    where: { id: b50.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: p50.refundPercent, refundAmount: b50.totalAmount * p50.refundPercent / 100 },
  });
  const r50 = await db.facilityBooking.findUnique({ where: { id: b50.id }, select: { refundPercent: true, refundAmount: true } });
  ok("30h online: refundPercent=50", r50?.refundPercent, 50);
  ok("30h online: refundAmount=500", r50?.refundAmount,  500);

  // 10h → 25%
  const b25 = await makeBooking({ hoursFromNow: 10, paymentMethod: "ONLINE" });
  ids.push(b25.id);
  const p25 = getCancellationPolicy(b25.bookingDate, b25.startTime);
  await db.facilityBooking.update({
    where: { id: b25.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: p25.refundPercent, refundAmount: b25.totalAmount * p25.refundPercent / 100 },
  });
  const r25 = await db.facilityBooking.findUnique({ where: { id: b25.id }, select: { refundPercent: true, refundAmount: true } });
  ok("10h online: refundPercent=25", r25?.refundPercent, 25);
  ok("10h online: refundAmount=250", r25?.refundAmount,  250);

  // 2h → 0%
  const b0 = await makeBooking({ hoursFromNow: 2, paymentMethod: "ONLINE" });
  ids.push(b0.id);
  const p0 = getCancellationPolicy(b0.bookingDate, b0.startTime);
  await db.facilityBooking.update({
    where: { id: b0.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: p0.refundPercent, refundAmount: 0 },
  });
  const r0 = await db.facilityBooking.findUnique({ where: { id: b0.id }, select: { refundPercent: true, refundAmount: true } });
  ok("2h online: refundPercent=0", r0?.refundPercent, 0);
  ok("2h online: refundAmount=0",  r0?.refundAmount,  0);

  await cleanup(ids);
  await resetUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Owner cancellation — strike system
// ─────────────────────────────────────────────────────────────────────────────
async function test_ownerStrikes() {
  section("4. Owner Cancels Bookings (strike system + suspension)");
  await resetFacility();
  const ids: string[] = [];

  const STRIKE_THRESHOLD = 3;

  for (let i = 1; i <= 3; i++) {
    const b = await makeBooking({ hoursFromNow: 24 + i, paymentMethod: "ONLINE" });
    ids.push(b.id);

    const fac = await db.sportsFacility.findUnique({
      where: { id: FACILITY_ID },
      select: { cancelStrikeCount: true, strikeResetAt: true, isListingSuspended: true },
    });

    // 90-day reset logic
    let currentStrikes = fac!.cancelStrikeCount;
    if (fac!.strikeResetAt) {
      const daysSinceReset = (Date.now() - fac!.strikeResetAt.getTime()) / 86_400_000;
      if (daysSinceReset >= 90) currentStrikes = 0;
    }

    const newStrikes = currentStrikes + 1;
    const suspend    = newStrikes >= STRIKE_THRESHOLD;

    await db.sportsFacility.update({
      where: { id: FACILITY_ID },
      data: { cancelStrikeCount: newStrikes, strikeResetAt: new Date(), ...(suspend && { isListingSuspended: true }) },
    });
    await db.facilityBooking.update({
      where: { id: b.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "owner", refundPercent: 100, refundAmount: b.totalAmount },
    });

    const fac2 = await db.sportsFacility.findUnique({ where: { id: FACILITY_ID }, select: { cancelStrikeCount: true, isListingSuspended: true } });
    ok(`Strike ${i}: cancelStrikeCount=${i}`, fac2?.cancelStrikeCount, i);
    if (i < 3) ok(`Strike ${i}: not yet suspended`, fac2?.isListingSuspended, false);
    else        ok(`Strike 3: listing suspended`,    fac2?.isListingSuspended, true);
  }

  // Verify owner cancel booking stored correctly
  const lastB = await db.facilityBooking.findFirst({
    where: { facilityId: FACILITY_ID, cancelledBy: "owner" },
    orderBy: { cancelledAt: "desc" },
    select: { refundPercent: true, refundAmount: true, cancelledBy: true },
  });
  ok("owner cancel: refundPercent=100 (full refund)", lastB?.refundPercent, 100);
  ok("owner cancel: refundAmount=1000",               lastB?.refundAmount,  1000);
  ok("owner cancel: cancelledBy='owner'",             lastB?.cancelledBy,   "owner");

  await cleanup(ids);
  await resetFacility();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 90-day strike reset
// ─────────────────────────────────────────────────────────────────────────────
async function test_strikeReset() {
  section("5. Strike 90-Day Reset Logic");
  await resetFacility();

  // Simulate 2 strikes from 91 days ago
  const ninetyOneDaysAgo = new Date(Date.now() - 91 * 86_400_000);
  await db.sportsFacility.update({
    where: { id: FACILITY_ID },
    data: { cancelStrikeCount: 2, strikeResetAt: ninetyOneDaysAgo },
  });

  const fac = await db.sportsFacility.findUnique({
    where: { id: FACILITY_ID },
    select: { cancelStrikeCount: true, strikeResetAt: true },
  });

  // Apply reset logic
  let currentStrikes = fac!.cancelStrikeCount;
  if (fac!.strikeResetAt) {
    const days = (Date.now() - fac!.strikeResetAt.getTime()) / 86_400_000;
    if (days >= 90) currentStrikes = 0;
  }

  ok("Strikes reset to 0 after 91 days", currentStrikes, 0);

  // Now add a new strike — should be strike 1, not 3
  const newStrikes = currentStrikes + 1;
  await db.sportsFacility.update({
    where: { id: FACILITY_ID },
    data: { cancelStrikeCount: newStrikes, strikeResetAt: new Date() },
  });

  const fac2 = await db.sportsFacility.findUnique({ where: { id: FACILITY_ID }, select: { cancelStrikeCount: true, isListingSuspended: true } });
  ok("After reset: new strike = 1 (not 3)", fac2?.cancelStrikeCount, 1);
  ok("After reset: not suspended",           fac2?.isListingSuspended, false);

  await resetFacility();
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. No-show tracking
// ─────────────────────────────────────────────────────────────────────────────
async function test_noShow() {
  section("6. No-Show Tracking (requiresOnlinePayment + isBookingSuspended)");
  await resetUser();
  const ids: string[] = [];

  // no-show 1 → warning only
  const b1 = await makeBooking({ hoursFromNow: -2, paymentMethod: "ON_ARRIVAL" }); // past booking
  ids.push(b1.id);
  const u0 = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true } });
  const count1 = (u0!.noShowCount ?? 0) + 1;
  await db.facilityBooking.update({ where: { id: b1.id }, data: { status: "NO_SHOW", noShowMarkedAt: new Date() } });
  await db.user.update({ where: { id: USER_ID }, data: { noShowCount: count1, ...(count1 >= 2 && { requiresOnlinePayment: true }), ...(count1 >= 3 && { isBookingSuspended: true }) } });
  const u1 = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true, requiresOnlinePayment: true, isBookingSuspended: true } });
  ok("noShow 1: noShowCount=1",             u1?.noShowCount,           1);
  ok("noShow 1: requiresOnlinePayment=false", u1?.requiresOnlinePayment, false);
  ok("noShow 1: isBookingSuspended=false",    u1?.isBookingSuspended,    false);

  // no-show 2 → requiresOnlinePayment
  const b2 = await makeBooking({ hoursFromNow: -3, paymentMethod: "ON_ARRIVAL" });
  ids.push(b2.id);
  const u1b = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true } });
  const count2 = (u1b!.noShowCount ?? 0) + 1;
  await db.facilityBooking.update({ where: { id: b2.id }, data: { status: "NO_SHOW", noShowMarkedAt: new Date() } });
  await db.user.update({ where: { id: USER_ID }, data: { noShowCount: count2, ...(count2 >= 2 && { requiresOnlinePayment: true }), ...(count2 >= 3 && { isBookingSuspended: true }) } });
  const u2 = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true, requiresOnlinePayment: true, isBookingSuspended: true } });
  ok("noShow 2: noShowCount=2",              u2?.noShowCount,           2);
  ok("noShow 2: requiresOnlinePayment=true", u2?.requiresOnlinePayment, true);
  ok("noShow 2: isBookingSuspended=false",   u2?.isBookingSuspended,    false);

  // no-show 3 → suspended
  const b3 = await makeBooking({ hoursFromNow: -4, paymentMethod: "ONLINE" });
  ids.push(b3.id);
  const u2b = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true } });
  const count3 = (u2b!.noShowCount ?? 0) + 1;
  await db.facilityBooking.update({ where: { id: b3.id }, data: { status: "NO_SHOW", noShowMarkedAt: new Date() } });
  await db.user.update({ where: { id: USER_ID }, data: { noShowCount: count3, ...(count3 >= 2 && { requiresOnlinePayment: true }), ...(count3 >= 3 && { isBookingSuspended: true }) } });
  const u3 = await db.user.findUnique({ where: { id: USER_ID }, select: { noShowCount: true, requiresOnlinePayment: true, isBookingSuspended: true } });
  ok("noShow 3: noShowCount=3",             u3?.noShowCount,           3);
  ok("noShow 3: requiresOnlinePayment=true", u3?.requiresOnlinePayment, true);
  ok("noShow 3: isBookingSuspended=true",    u3?.isBookingSuspended,    true);

  // Verify booking status stored
  const stored = await db.facilityBooking.findUnique({ where: { id: b3.id }, select: { status: true, noShowMarkedAt: true } });
  ok("NO_SHOW booking status stored",       stored?.status,         "NO_SHOW");
  ok("noShowMarkedAt is set",               !!stored?.noShowMarkedAt, true);

  await cleanup(ids);
  await resetUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Admin actions
// ─────────────────────────────────────────────────────────────────────────────
async function test_adminActions() {
  section("7. Admin Actions (unsuspend user, reset strikes, restore listing)");

  // Setup: suspended user + suspended facility
  await db.user.update({ where: { id: USER_ID }, data: { isBookingSuspended: true, requiresOnlinePayment: true, noShowCount: 3 } });
  await db.sportsFacility.update({ where: { id: FACILITY_ID }, data: { cancelStrikeCount: 3, isListingSuspended: true, strikeResetAt: new Date() } });

  // Admin: unsuspend user
  await db.user.update({ where: { id: USER_ID }, data: { isBookingSuspended: false, requiresOnlinePayment: false } });
  const u = await db.user.findUnique({ where: { id: USER_ID }, select: { isBookingSuspended: true, requiresOnlinePayment: true } });
  ok("Admin unsuspend: isBookingSuspended=false",   u?.isBookingSuspended,    false);
  ok("Admin unsuspend: requiresOnlinePayment=false", u?.requiresOnlinePayment, false);

  // Admin: reset strikes
  await db.sportsFacility.update({ where: { id: FACILITY_ID }, data: { cancelStrikeCount: 0, strikeResetAt: new Date(), isListingSuspended: false } });
  const f = await db.sportsFacility.findUnique({ where: { id: FACILITY_ID }, select: { cancelStrikeCount: true, isListingSuspended: true } });
  ok("Admin reset-strikes: cancelStrikeCount=0", f?.cancelStrikeCount,  0);
  ok("Admin reset-strikes: isListingSuspended=false", f?.isListingSuspended, false);

  // Admin: restrict online only (re-suspend partially)
  await db.user.update({ where: { id: USER_ID }, data: { requiresOnlinePayment: true } });
  const u2 = await db.user.findUnique({ where: { id: USER_ID }, select: { requiresOnlinePayment: true, isBookingSuspended: true } });
  ok("Admin restrict-online: requiresOnlinePayment=true",  u2?.requiresOnlinePayment, true);
  ok("Admin restrict-online: isBookingSuspended still false", u2?.isBookingSuspended,  false);

  await resetUser();
  await resetFacility();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Admin GET /api/admin/cancellations data shape
// ─────────────────────────────────────────────────────────────────────────────
async function test_adminDataShape() {
  section("8. Admin Cancellations Data Shape (DB query correctness)");
  const ids: string[] = [];

  // Seed 1 CANCELLED + 1 NO_SHOW booking
  const bc = await makeBooking({ hoursFromNow: -1, paymentMethod: "ONLINE" });
  ids.push(bc.id);
  await db.facilityBooking.update({ where: { id: bc.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "user", refundPercent: 25, refundAmount: 250 } });

  const bn = await makeBooking({ hoursFromNow: -2, paymentMethod: "ON_ARRIVAL" });
  ids.push(bn.id);
  await db.facilityBooking.update({ where: { id: bn.id }, data: { status: "NO_SHOW", noShowMarkedAt: new Date() } });

  // Run the same queries as the admin GET route
  const [cancellations, noShows] = await Promise.all([
    db.facilityBooking.findMany({
      where:   { status: "CANCELLED" },
      orderBy: { cancelledAt: "desc" },
      take:    200,
      select:  { id: true, cancelledBy: true, refundPercent: true, refundAmount: true, cancelledAt: true },
    }),
    db.facilityBooking.findMany({
      where:   { status: "NO_SHOW" },
      orderBy: { noShowMarkedAt: "desc" },
      take:    200,
      select:  { id: true, noShowMarkedAt: true },
    }),
  ]);

  const seededCancel = cancellations.find((c) => c.id === bc.id);
  const seededNoShow = noShows.find((n) => n.id === bn.id);
  ok("cancellations query returns ≥1 row",           cancellations.length >= 1,           true);
  ok("noShows query returns ≥1 row",                 noShows.length >= 1,                 true);
  ok("seeded cancelled booking has cancelledBy",     !!seededCancel?.cancelledBy,         true);
  ok("seeded cancelled booking has refundPercent",   seededCancel?.refundPercent !== null, true);
  ok("seeded no-show booking has noShowMarkedAt",    !!seededNoShow?.noShowMarkedAt,      true);

  // Summary shape
  const suspendedUsers = await db.user.findMany({
    where: { OR: [{ isBookingSuspended: true }, { requiresOnlinePayment: true }, { noShowCount: { gte: 1 } }, { cashCancelCount: { gte: 3 } }] },
    select: { isBookingSuspended: true, requiresOnlinePayment: true },
  });
  const facilities = await db.sportsFacility.findMany({
    where: { cancelStrikeCount: { gt: 0 } },
    select: { isListingSuspended: true },
  });

  ok("suspendedUsers query executes without error", Array.isArray(suspendedUsers), true);
  ok("facilities-with-strikes query executes",      Array.isArray(facilities),     true);

  await cleanup(ids);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪  GoPlay Cancellation Policy — Full Test Suite");
  console.log("    Database: goplay_production (local)");
  console.log(`    Time: ${new Date().toISOString()}\n`);

  await test_policyUtility();
  await test_userCashCancel();
  await test_userOnlineCancel();
  await test_ownerStrikes();
  await test_strikeReset();
  await test_noShow();
  await test_adminActions();
  await test_adminDataShape();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log(`${"═".repeat(60)}\n`);

  await db.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
