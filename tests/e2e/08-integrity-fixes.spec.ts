/**
 * Integrity fixes: the money and trust rules from the October 2026 health report.
 *
 * Each test pins one rule that used to be breakable through the API: booking status changes,
 * late cancellations, ground deletion, lobby money, accounts and roles.
 * Run: npx playwright test --project=integrity   (local dev server + local database only)
 */
import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import {
  BASE, PASSWORD, ACCOUNTS, OWNER, assertLocal, seedAccounts, groundFixture, seedBooking, snapshot, cleanup, closeDb, q, TAG, cronSecret,
} from "./helpers/admin-fixtures";

test.describe.configure({ mode: "serial" });

let ids: Awaited<ReturnType<typeof seedAccounts>>;
let ground: Awaited<ReturnType<typeof groundFixture>>;
let snap: Awaited<ReturnType<typeof snapshot>> | null = null;
const tokens: Record<"ana" | "ben" | "owner", string> = { ana: "", ben: "", owner: "" };
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
let adminCtx: BrowserContext;
let admin: APIRequestContext;

async function webLogin(ctx: BrowserContext, email: string, password: string) {
  const { csrfToken } = await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json();
  await ctx.request.post(`${BASE}/api/auth/callback/credentials`, { form: { csrfToken, email, password, turnstileToken: "test", json: "true" } });
  const s = await (await ctx.request.get(`${BASE}/api/auth/session`)).json();
  expect(s?.user?.email, `web sign-in as ${email}`).toBe(email);
}

/** A lobby straight in the database, so tests can set dates and states no API allows. */
async function seedLobby(o: { daysFromToday: number; payee?: "PLATFORM" | "GROUND"; status?: string }) {
  const id = `${TAG}m${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await q(
    `insert into "OpenMatch" (id, "facilityId", "categoryId", "preferredDate", "preferredStartTime", "preferredEndTime", "totalSpotsNeeded",
       "spotsReserved", status, payee, "expiresAt", "createdAt", "updatedAt")
     values ($1, $2, $3, current_date + $4::int, '18:00', '19:00', $5, 1, $6, $7, now() + interval '2 days', now(), now())`,
    [id, ground.id, ground.categoryId, o.daysFromToday, ground.minPlayers, o.status ?? "COLLECTING", o.payee ?? "PLATFORM"],
  );
  return id;
}
async function seedSpot(o: { matchId: string; userId: string; status?: string; paymentStatus?: string; amountPaid?: number; amountDue?: number; refundAmount?: number | null; refundStatus?: string }) {
  const id = `${TAG}s${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await q(
    `insert into "OpenMatchSpot" (id, "matchId", "userId", "groupSize", status, "paymentStatus", "amountPaid", "amountDue", "refundAmount", "refundStatus", "createdAt", "updatedAt")
     values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, now(), now())`,
    [id, o.matchId, o.userId, o.status ?? "RESERVED", o.paymentStatus ?? "PENDING", o.amountPaid ?? 0, o.amountDue ?? 1000, o.refundAmount ?? null, o.refundStatus ?? "NONE"],
  );
  return id;
}

async function mobileLogin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${BASE}/api/auth/mobile-login`, { data: { email, password } });
  expect(res.status(), `mobile sign-in for ${email}`).toBe(200);
  return (await res.json()).token as string;
}
const bookingRow = async (id: string) =>
  (await q<{ status: string; refundStatus: string; paymentStatus: string }>(`select status, "refundStatus", "paymentStatus" from "FacilityBooking" where id = $1`, [id]))[0];

test.beforeAll(async ({ request, browser }) => {
  assertLocal();
  ground = await groundFixture();
  snap   = await snapshot(ground.id, ground.ownerId);
  ids    = await seedAccounts();
  tokens.ana   = await mobileLogin(request, ACCOUNTS.ana.email, PASSWORD);
  tokens.ben   = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);
  tokens.owner = await mobileLogin(request, OWNER.email, OWNER.password);
  adminCtx = await browser.newContext();
  await webLogin(adminCtx, ACCOUNTS.admin.email, PASSWORD);
  admin = adminCtx.request;
});

test.afterAll(async () => {
  await adminCtx?.close();
  if (ids) await cleanup(ids, snap, ground?.id, ground?.ownerId);
  // Lobbies with no spots aren't found by cleanup(); test grounds go last, after their bookings
  // and earnings (money relations restrict deletes)
  await q(`delete from "OpenMatchSpot" where "matchId" like $1`, [`${TAG}%`]);
  await q(`delete from "OpenMatch" where id like $1`, [`${TAG}%`]);
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

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Open match money", () => {
  test("a lobby whose time has passed can't be left (it is closed and refunded in full instead)", async ({ request }) => {
    const m = await seedLobby({ daysFromToday: -1 });
    const spot = await seedSpot({ matchId: m, userId: ids.ana, paymentStatus: "PAID", amountPaid: 1000 });
    const res = await request.delete(`${BASE}/api/open-matches/${m}/spot`, { headers: bearer(tokens.ana) });
    expect(res.status()).toBe(409);
    const [row] = await q<{ status: string }>(`select status from "OpenMatchSpot" where id = $1`, [spot]);
    expect(row.status).toBe("RESERVED");
  });

  test("money GoPlay keeps from a player who left counts in GoPlay's earnings", async () => {
    const summary = async () => (await (await admin.get(`${BASE}/api/admin/earnings`)).json()).summary;
    const before  = await summary();
    const m = await seedLobby({ daysFromToday: 3 });
    // Paid 1,000, left with a 25% refund owed: GoPlay keeps 750
    await seedSpot({ matchId: m, userId: ids.ben, status: "REFUNDED", paymentStatus: "PAID", amountPaid: 1000, refundAmount: 250, refundStatus: "NEEDED" });
    const after = await summary();
    expect(after.lobbyRetained.total - before.lobbyRetained.total).toBeCloseTo(750, 2);
    expect(after.goplay.total - before.goplay.total).toBeCloseTo(750, 2);
    const lp = (await (await admin.get(`${BASE}/api/admin/lobby-payments`)).json()).summary;
    expect(lp.goplayEarned).toBeCloseTo(after.lobbyMargin.total + after.lobbyRetained.total, 2);   // one figure everywhere
  });

  test("a lobby that ran out of time is closed and its refunds queued as soon as someone opens it", async ({ request }) => {
    const m = await seedLobby({ daysFromToday: 2 });
    const spot = await seedSpot({ matchId: m, userId: ids.ana, paymentStatus: "PAID", amountPaid: 1200, amountDue: 1200 });
    await q(`update "OpenMatch" set "expiresAt" = (now() at time zone 'utc') - interval '1 minute' where id = $1`, [m]);
    const lobby = await (await request.get(`${BASE}/api/open-matches/${m}`, { headers: bearer(tokens.ana) })).json();
    expect(lobby.status).toBe("EXPIRED");
    const [row] = await q<{ status: string; refundStatus: string; refundAmount: number }>(`select status, "refundStatus", "refundAmount" from "OpenMatchSpot" where id = $1`, [spot]);
    expect([row.status, row.refundStatus, row.refundAmount]).toEqual(["REFUNDED", "NEEDED", 1200]);
  });

  test("a group size must be a whole number", async ({ request }) => {
    const m = await seedLobby({ daysFromToday: 4 });
    const res = await request.post(`${BASE}/api/open-matches/${m}/join`, { headers: bearer(tokens.ben), data: { groupSize: 1.5 } });
    expect(res.status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Accounts and access", () => {
  test("an owner can't turn a player into a worker — the player accepts an invitation, and access follows the account", async ({ request }) => {
    const add = await request.post(`${BASE}/api/ground-owner/workers`, { headers: bearer(tokens.owner), data: { facilityId: ground.id, email: ACCOUNTS.ana.email.toUpperCase() } });
    expect(add.status()).toBe(202);
    const body = await add.json();
    expect(body.invited).toBe(true);
    expect(body.worker.name).toBeTruthy();   // older owner-app builds read worker.name
    const [before] = await q<{ role: string }>(`select role from "User" where id = $1`, [ids.ana]);
    expect(before.role).toBe("USER");

    // The same token is a player's until they accept…
    expect((await request.get(`${BASE}/api/worker/facility`, { headers: bearer(tokens.ana) })).status()).toBe(403);
    const mine = (await (await request.get(`${BASE}/api/worker-invites`, { headers: bearer(tokens.ana) })).json()).invites;
    expect(mine).toHaveLength(1);
    const accept = await request.post(`${BASE}/api/worker-invites/${mine[0].id}`, { headers: bearer(tokens.ana), data: { action: "accept" } });
    expect(accept.status()).toBe(200);

    // …and a worker's from the next request, without signing in again
    expect((await request.get(`${BASE}/api/worker/facility`, { headers: bearer(tokens.ana) })).status()).toBe(200);
    const list = await (await request.get(`${BASE}/api/ground-owner/workers?facilityId=${ground.id}`, { headers: bearer(tokens.owner) })).json();
    const w = list.workers.find((x: { userId: string }) => x.userId === ids.ana);
    expect(w).toBeTruthy();
    expect(list.invites).toHaveLength(0);

    // Removing them takes the access away at once, with the same token
    expect((await request.delete(`${BASE}/api/ground-owner/workers/${w.id}`, { headers: bearer(tokens.owner) })).status()).toBe(200);
    expect((await request.get(`${BASE}/api/worker/facility`, { headers: bearer(tokens.ana) })).status()).toBe(403);
  });

  test("a declined or withdrawn invitation changes nothing", async ({ request }) => {
    await request.post(`${BASE}/api/ground-owner/workers`, { headers: bearer(tokens.owner), data: { facilityId: ground.id, email: ACCOUNTS.ben.email } });
    const [inv] = (await (await request.get(`${BASE}/api/worker-invites`, { headers: bearer(tokens.ben) })).json()).invites;
    expect((await request.post(`${BASE}/api/worker-invites/${inv.id}`, { headers: bearer(tokens.ben), data: { action: "decline" } })).status()).toBe(200);
    expect((await request.post(`${BASE}/api/worker-invites/${inv.id}`, { headers: bearer(tokens.ben), data: { action: "accept" } })).status()).toBe(409);

    await request.post(`${BASE}/api/ground-owner/workers`, { headers: bearer(tokens.owner), data: { facilityId: ground.id, email: ACCOUNTS.ben.email } });
    const [inv2] = (await (await request.get(`${BASE}/api/worker-invites`, { headers: bearer(tokens.ben) })).json()).invites;
    expect((await request.delete(`${BASE}/api/ground-owner/workers/invites/${inv2.id}`, { headers: bearer(tokens.owner) })).status()).toBe(200);
    expect((await request.post(`${BASE}/api/worker-invites/${inv2.id}`, { headers: bearer(tokens.ben), data: { action: "accept" } })).status()).toBe(409);
    const [ben] = await q<{ role: string }>(`select role from "User" where id = $1`, [ids.ben]);
    expect(ben.role).toBe("USER");
  });

  test("signing in ignores the letter case of the email", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/mobile-login`, { data: { email: ACCOUNTS.ben.email.toUpperCase(), password: PASSWORD } });
    expect(res.status()).toBe(200);
  });

  test("only players who have paid into a lobby see co-players' phone numbers, and never emails", async ({ request }) => {
    const m = await seedLobby({ daysFromToday: 6 });
    await seedSpot({ matchId: m, userId: ids.ana, paymentStatus: "PAID", amountPaid: 1000 });
    await seedSpot({ matchId: m, userId: ids.ben, paymentStatus: "PENDING" });
    const asBen = await (await request.get(`${BASE}/api/open-matches/${m}`, { headers: bearer(tokens.ben) })).json();
    expect(asBen.spots.every((s: { user: { phone: string | null; email: string | null } }) => s.user.phone === null && s.user.email === null)).toBe(true);
    const asAna = await (await request.get(`${BASE}/api/open-matches/${m}`, { headers: bearer(tokens.ana) })).json();
    const benSpot = asAna.spots.find((s: { user: { id: string } }) => s.user.id === ids.ben);
    expect(benSpot.user.phone).toBe(ACCOUNTS.ben.phone);
    expect(benSpot.user.email).toBeNull();
  });

  test("a blocked player can't be switched back on from the users page", async () => {
    expect((await admin.post(`${BASE}/api/admin/trust/block`, { data: { userId: ids.ben, reason: "ABUSE", details: "e2e" } })).status()).toBe(200);
    const res = await admin.patch(`${BASE}/api/admin/users/${ids.ben}/status`, { data: { isActive: true } });
    expect(res.status()).toBe(409);
    const [block] = await q<{ id: string }>(`select id from "AccountBlock" where "userId" = $1 and "liftedAt" is null`, [ids.ben]);
    expect((await admin.post(`${BASE}/api/admin/trust/unblock`, { data: { blockId: block.id } })).status()).toBe(200);
  });

  test("changing a ground's payout account alerts the owner", async ({ request }) => {
    const [orig] = await q<Record<string, string | null>>(
      `select "paymentBankName", "paymentBankBranch", "paymentAccountName", "paymentAccountNumber", "paymentInstructions" from "SportsFacility" where id = $1`, [ground.id]);
    const alertsNow = async () => (await q(`select 1 from "Notification" where "userId" = $1 and title = 'Payout bank account changed'`, [ground.ownerUserId])).length;
    const before = await alertsNow();
    try {
      const res = await request.put(`${BASE}/api/ground-owner/grounds/${ground.id}/payment-details`, {
        headers: bearer(tokens.owner),
        data: { paymentBankName: "E2E Bank", paymentAccountName: "E2E Owner", paymentAccountNumber: `99${Date.now().toString().slice(-8)}` },
      });
      expect(res.status()).toBe(200);
      expect(await alertsNow()).toBe(before + 1);
    } finally {
      await q(
        `update "SportsFacility" set "paymentBankName" = $2, "paymentBankBranch" = $3, "paymentAccountName" = $4, "paymentAccountNumber" = $5, "paymentInstructions" = $6 where id = $1`,
        [ground.id, orig.paymentBankName, orig.paymentBankBranch, orig.paymentAccountName, orig.paymentAccountNumber, orig.paymentInstructions]);
      await q(`delete from "Notification" where "userId" = $1 and title = 'Payout bank account changed'`, [ground.ownerUserId]);
      await q(`delete from "RateLimit" where key like 'payout-account:%'`);
    }
  });

  test("the application-status lookup doesn't reveal names", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/mobile-application-status`, { data: { email: OWNER.email } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
    expect(body.name).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("No-show reports", () => {
  const counts = async (userId: string) =>
    (await q<{ noShowCount: number; requiresOnlinePayment: boolean }>(`select "noShowCount", "requiresOnlinePayment" from "User" where id = $1`, [userId]))[0];
  const report = async (request: APIRequestContext, start: string) => {
    const id = await seedBooking({ userId: ids.ben, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` });
    expect((await request.put(`${BASE}/api/ground-owner/bookings/${id}/noshow`, { headers: bearer(tokens.owner) })).status()).toBe(200);
    return id;
  };
  const runCron = async (request: APIRequestContext) => {
    const secret = cronSecret();
    test.skip(!secret, "CRON_SECRET isn't set in the local .env");
    expect((await request.get(`${BASE}/api/cron/release-pending-slots`, { headers: { Authorization: `Bearer ${secret}` } })).status()).toBe(200);
  };

  test("a report doesn't count at first, then counts once 48 hours pass without a dispute", async ({ request }) => {
    await q(`update "User" set "noShowCount" = 0, "requiresOnlinePayment" = false, "isBookingSuspended" = false where id = $1`, [ids.ben]);
    const id = await report(request, "12:00");
    expect((await counts(ids.ben)).noShowCount).toBe(0);
    // A second owner tap is refused rather than reported twice
    expect((await request.put(`${BASE}/api/ground-owner/bookings/${id}/noshow`, { headers: bearer(tokens.owner) })).status()).toBe(400);

    await q(`update "FacilityBooking" set "noShowMarkedAt" = (now() at time zone 'utc') - interval '49 hours' where id = $1`, [id]);
    await runCron(request);
    const [b] = await q<{ noShowReview: string }>(`select "noShowReview" from "FacilityBooking" where id = $1`, [id]);
    expect(b.noShowReview).toBe("CONFIRMED");
    expect((await counts(ids.ben)).noShowCount).toBe(1);
  });

  test("a disputed report waits for GoPlay, and counts only when an admin confirms it", async ({ request }) => {
    await q(`update "User" set "noShowCount" = 0, "requiresOnlinePayment" = false, "isBookingSuspended" = false where id = $1`, [ids.ben]);
    await q(`update "FacilityBooking" set "noShowReview" = 'OVERTURNED' where "userId" = $1 and status = 'NO_SHOW'`, [ids.ben]);
    tokens.ben = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);   // the blocking test ended his old sessions
    const id = await report(request, "14:00");
    const dispute = await request.post(`${BASE}/api/user/bookings/${id}/dispute-noshow`, { headers: bearer(tokens.ben), data: { message: "I was there and played the whole hour." } });
    expect(dispute.status()).toBe(200);
    await q(`update "FacilityBooking" set "noShowMarkedAt" = (now() at time zone 'utc') - interval '49 hours' where id = $1`, [id]);
    await runCron(request);
    expect((await counts(ids.ben)).noShowCount).toBe(0);

    expect((await admin.post(`${BASE}/api/admin/trust/noshow/${id}`, { data: { decision: "confirm" } })).status()).toBe(200);
    expect((await counts(ids.ben)).noShowCount).toBe(1);
    // Reviewed once only
    expect((await admin.post(`${BASE}/api/admin/trust/noshow/${id}`, { data: { decision: "overturn" } })).status()).toBe(409);
  });

  test("a no-show can't be disputed after 48 hours, or once it counts", async ({ request }) => {
    tokens.ben = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);
    const late = await report(request, "16:00");
    await q(`update "FacilityBooking" set "noShowMarkedAt" = (now() at time zone 'utc') - interval '49 hours' where id = $1`, [late]);
    const msg = { message: "I was there and played the whole hour." };
    expect((await request.post(`${BASE}/api/user/bookings/${late}/dispute-noshow`, { headers: bearer(tokens.ben), data: msg })).status()).toBe(409);

    const counted = await report(request, "18:00");
    await q(`update "FacilityBooking" set "noShowReview" = 'CONFIRMED' where id = $1`, [counted]);
    expect((await request.post(`${BASE}/api/user/bookings/${counted}/dispute-noshow`, { headers: bearer(tokens.ben), data: msg })).status()).toBe(409);
    const [row] = await q<{ noShowReview: string }>(`select "noShowReview" from "FacilityBooking" where id = $1`, [counted]);
    expect(row.noShowReview).toBe("CONFIRMED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Commission settlement", () => {
  test("a settlement records the payment and exactly the commission the admin saw", async () => {
    const done = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -3, start: "20:00", end: "21:00", status: "COMPLETED" });
    await q(
      `insert into "GroundEarning" (id, "bookingId", "facilityId", "ownerId", "grossAmount", "platformFee", "netAmount", "paymentMethod", "earnedAt")
       values ($1, $2, $3, $4, 2500, 250, 2250, 'ON_ARRIVAL', now())`,
      [`${TAG}e${Date.now()}`, done, ground.id, ground.ownerId],
    );
    const [{ owed }] = await q<{ owed: number }>(`select coalesce(sum("platformFee"), 0) as owed from "GroundEarning" where "ownerId" = $1 and not "commissionPaid" and "platformFee" > 0`, [ground.ownerId]);

    // The admin's page is out of date: nothing is settled
    const stale = await admin.post(`${BASE}/api/admin/commissions/${ground.ownerId}/settle`, { data: { expectedTotal: owed - 250, reference: "E2E-STALE" } });
    expect(stale.status()).toBe(409);
    expect(await q(`select 1 from "CommissionSettlement" where reference = 'E2E-STALE'`)).toHaveLength(0);

    const ok = await admin.post(`${BASE}/api/admin/commissions/${ground.ownerId}/settle`, { data: { expectedTotal: owed, reference: "E2E-REF-9", note: "Bank transfer" } });
    expect(ok.status()).toBe(200);
    const { settlementId } = await ok.json();
    const [st] = await q<{ amount: number; reference: string }>(`select amount, reference from "CommissionSettlement" where id = $1`, [settlementId]);
    expect(st.amount).toBeCloseTo(owed, 2);
    expect(st.reference).toBe("E2E-REF-9");
    const [e] = await q<{ commissionPaid: boolean; settlementId: string }>(`select "commissionPaid", "settlementId" from "GroundEarning" where "bookingId" = $1`, [done]);
    expect([e.commissionPaid, e.settlementId]).toEqual([true, settlementId]);
  });
});
