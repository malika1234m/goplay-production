/**
 * Integrity fixes: the money and trust rules from the October 2026 health report.
 *
 * Each test pins one rule that used to be breakable through the API: booking status changes,
 * late cancellations, ground deletion, lobby money, accounts and roles.
 * Run: npx playwright test --project=integrity   (local dev server + local database only)
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  BASE, PASSWORD, ACCOUNTS, OWNER, assertLocal, seedAccounts, groundFixture, seedBooking, snapshot, cleanup, closeDb, q, TAG,
} from "./helpers/admin-fixtures";

test.describe.configure({ mode: "serial" });

let ids: Awaited<ReturnType<typeof seedAccounts>>;
let ground: Awaited<ReturnType<typeof groundFixture>>;
let snap: Awaited<ReturnType<typeof snapshot>> | null = null;
const tokens: Record<"ana" | "ben" | "owner", string> = { ana: "", ben: "", owner: "" };
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function mobileLogin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${BASE}/api/auth/mobile-login`, { data: { email, password } });
  expect(res.status(), `mobile sign-in for ${email}`).toBe(200);
  return (await res.json()).token as string;
}
const bookingRow = async (id: string) =>
  (await q<{ status: string; refundStatus: string; paymentStatus: string }>(`select status, "refundStatus", "paymentStatus" from "FacilityBooking" where id = $1`, [id]))[0];

test.beforeAll(async ({ request }) => {
  assertLocal();
  ground = await groundFixture();
  snap   = await snapshot(ground.id, ground.ownerId);
  ids    = await seedAccounts();
  tokens.ana   = await mobileLogin(request, ACCOUNTS.ana.email, PASSWORD);
  tokens.ben   = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);
  tokens.owner = await mobileLogin(request, OWNER.email, OWNER.password);
});

test.afterAll(async () => {
  if (ids) await cleanup(ids, snap, ground?.id, ground?.ownerId);
  // Test grounds go last: their bookings and earnings must be gone first (money relations restrict deletes)
  await q(`delete from "SportsFacility" where name like $1`, [`${TAG}%`]);
  await closeDb();
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Booking status rules for grounds", () => {
  const setStatus = (request: APIRequestContext, id: string, status: string, extra: object = {}) =>
    request.put(`${BASE}/api/ground-owner/bookings/${id}/status`, { headers: bearer(tokens.owner), data: { status, ...extra } });

  test("a no-show can't be flipped by the owner — it stays in GoPlay's review", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start: "06:00", end: "07:00", status: "NO_SHOW" });
    await q(`update "FacilityBooking" set "noShowReview" = 'PENDING', "noShowMarkedAt" = now() where id = $1`, [id]);
    for (const to of ["CONFIRMED", "CANCELLED", "COMPLETED"]) {
      expect((await setStatus(request, id, to)).status(), `NO_SHOW -> ${to}`).toBe(400);
    }
    expect((await bookingRow(id)).status).toBe("NO_SHOW");
  });

  test("a cancelled booking can't be revived or cancelled again", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 9, start: "06:00", end: "07:00", paymentMethod: "ONLINE", paymentStatus: "PAID" });
    expect((await setStatus(request, id, "CANCELLED")).status()).toBe(200);
    expect((await bookingRow(id)).refundStatus).toBe("NEEDED");
    // The ground refunds it…
    const refund = await request.post(`${BASE}/api/ground-owner/bookings/${id}/refund`, { headers: bearer(tokens.owner), data: { note: "Sent", reference: "E2E-REF-1" } });
    expect(refund.status()).toBe(200);
    // …and nothing can put the refund back to "needed" or the slot back in play
    expect((await setStatus(request, id, "CANCELLED")).status()).toBe(400);
    expect((await setStatus(request, id, "CONFIRMED")).status()).toBe(400);
    const row = await bookingRow(id);
    expect([row.status, row.refundStatus]).toEqual(["CANCELLED", "PROCESSED"]);
  });

  test("an unpaid 'Pay online' booking can't be completed or confirmed by status", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start: "07:00", end: "08:00", status: "PENDING", paymentMethod: "ONLINE", paymentStatus: "PENDING" });
    expect((await setStatus(request, id, "COMPLETED")).status()).toBe(400);
    expect((await setStatus(request, id, "CONFIRMED")).status()).toBe(400);
    expect(await q(`select 1 from "GroundEarning" where "bookingId" = $1`, [id])).toHaveLength(0);
  });

  test("completing a cash booking records the earning exactly once", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start: "08:00", end: "09:00" });
    const [a, b] = await Promise.all([setStatus(request, id, "COMPLETED", { cashReceived: true }), setStatus(request, id, "COMPLETED", { cashReceived: true })]);
    // One wins; the other is refused, by the conditional write (409) or the status check (400)
    const codes = [a.status(), b.status()].sort();
    expect(codes[0]).toBe(200);
    expect([400, 409]).toContain(codes[1]);
    expect(await q(`select 1 from "GroundEarning" where "bookingId" = $1`, [id])).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Player cancellations", () => {
  test("a player can't cancel once the slot has started", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start: "10:00", end: "11:00" });
    const res = await request.put(`${BASE}/api/user/bookings/${id}/cancel`, { headers: bearer(tokens.ana) });
    expect(res.status()).toBe(400);
    expect((await bookingRow(id)).status).toBe("CONFIRMED");
  });

  test("a future booking can still be cancelled", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 12, start: "10:00", end: "11:00" });
    const res = await request.put(`${BASE}/api/user/bookings/${id}/cancel`, { headers: bearer(tokens.ana) });
    expect(res.status()).toBe(200);
    expect((await bookingRow(id)).status).toBe("CANCELLED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Deleting a ground", () => {
  test("a ground that was never used is deleted completely", async ({ request }) => {
    const id = `${TAG}g${Date.now()}`;
    await q(
      `insert into "SportsFacility" (id, name, address, city, "hourlyRate", "ownerId", status, "createdAt", "updatedAt")
       values ($1, $2, '1 Test Road', 'Kandy', 1000, $3, 'PENDING', now(), now())`,
      [id, `${TAG} Empty Ground`, ground.ownerId],
    );
    const res = await request.delete(`${BASE}/api/ground-owner/grounds/${id}`, { headers: bearer(tokens.owner) });
    expect(res.status()).toBe(200);
    expect((await res.json()).archived).toBe(false);
    expect(await q(`select 1 from "SportsFacility" where id = $1`, [id])).toHaveLength(0);
  });

  test("a ground with history is taken off GoPlay, and its bookings and earnings are kept", async ({ request }) => {
    const gid = `${TAG}h${Date.now()}`;
    await q(
      `insert into "SportsFacility" (id, name, address, city, "hourlyRate", "ownerId", status, "createdAt", "updatedAt")
       values ($1, $2, '2 Test Road', 'Kandy', 1000, $3, 'ACTIVE', now(), now())`,
      [gid, `${TAG} Used Ground`, ground.ownerId],
    );
    const done = await seedBooking({ userId: ids.ana, facilityId: gid, courtId: null, daysFromToday: -2, start: "06:00", end: "07:00", status: "COMPLETED" });
    await q(
      `insert into "GroundEarning" (id, "bookingId", "facilityId", "ownerId", "grossAmount", "platformFee", "netAmount", "paymentMethod", "earnedAt")
       values ($1, $2, $3, $4, 2500, 250, 2250, 'ON_ARRIVAL', now())`,
      [`${TAG}e${Date.now()}`, done, gid, ground.ownerId],
    );
    // An upcoming booking blocks it…
    const upcoming = await seedBooking({ userId: ids.ana, facilityId: gid, courtId: null, daysFromToday: 5, start: "06:00", end: "07:00" });
    expect((await request.delete(`${BASE}/api/ground-owner/grounds/${gid}`, { headers: bearer(tokens.owner) })).status()).toBe(400);
    await q(`update "FacilityBooking" set status = 'CANCELLED' where id = $1`, [upcoming]);

    // …then it is archived, not deleted
    const res = await request.delete(`${BASE}/api/ground-owner/grounds/${gid}`, { headers: bearer(tokens.owner) });
    expect(res.status()).toBe(200);
    expect((await res.json()).archived).toBe(true);
    const [f] = await q<{ status: string }>(`select status from "SportsFacility" where id = $1`, [gid]);
    expect(f.status).toBe("INACTIVE");
    expect(await q(`select 1 from "GroundEarning" where "bookingId" = $1`, [done])).toHaveLength(1);
    // And the database itself refuses to cascade money away
    await expect(q(`delete from "SportsFacility" where id = $1`, [gid])).rejects.toThrow();
  });
});
