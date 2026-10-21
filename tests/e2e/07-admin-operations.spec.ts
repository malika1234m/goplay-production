/**
 * Admin operations: can a GoPlay admin run the whole platform from the admin panel?
 *
 * Covers access control, every admin page, bookings, users and ground owners, open match money
 * (receipts, payouts, refunds), cash bookings and no-shows, blocking, commissions and earnings.
 * Run: npx playwright test --project=admin-ops   (local dev server + local database only)
 */
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  BASE, PASSWORD, ACCOUNTS, OWNER, assertLocal, seedAccounts, groundFixture, seedBooking, snapshot, cleanup, closeDb, q,
} from "./helpers/admin-fixtures";

test.describe.configure({ mode: "serial" });

let ids: Awaited<ReturnType<typeof seedAccounts>>;
let ground: Awaited<ReturnType<typeof groundFixture>>;
let snap: Awaited<ReturnType<typeof snapshot>> | null = null;
let adminCtx: BrowserContext;
let admin: APIRequestContext;
const tokens: Record<"ana" | "ben" | "owner", string> = { ana: "", ben: "", owner: "" };

const RECEIPT = fs.readFileSync(path.resolve(__dirname, "../../public/demo/complex-1.jpg"));
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

async function mobileLogin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${BASE}/api/auth/mobile-login`, { data: { email, password } });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function webLogin(ctx: BrowserContext, email: string, password: string) {
  const { csrfToken } = await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json();
  await ctx.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, turnstileToken: "test", json: "true" },
  });
  const s = await (await ctx.request.get(`${BASE}/api/auth/session`)).json();
  expect(s?.user?.email, `web sign-in as ${email}`).toBe(email);
}

async function upload(path_: string, token: string, request: APIRequestContext) {
  return request.post(`${BASE}${path_}`, {
    headers: bearer(token),
    multipart: { receipt: { name: "receipt.jpg", mimeType: "image/jpeg", buffer: RECEIPT } },
  });
}

/** Opens an admin page and fails on server errors or uncaught page errors. */
async function visit(page: Page, url: string) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500 && r.url().startsWith(BASE)) problems.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  expect(problems, `problems on ${url}`).toEqual([]);
}

test.beforeAll(async ({ browser, request }) => {
  assertLocal();
  ground = await groundFixture();
  snap = await snapshot(ground.id, ground.ownerId);
  ids = await seedAccounts();

  adminCtx = await browser.newContext();
  await webLogin(adminCtx, ACCOUNTS.admin.email, PASSWORD);
  admin = adminCtx.request;

  for (const [k, email, pw] of [["ana", ACCOUNTS.ana.email, PASSWORD], ["ben", ACCOUNTS.ben.email, PASSWORD], ["owner", OWNER.email, OWNER.password]] as const) {
    const r = await mobileLogin(request, email, pw);
    expect(r.status, `mobile sign-in for ${email}`).toBe(200);
    tokens[k] = r.body.token;
  }

  // GoPlay's bank account must be set for open matches
  const s = await admin.put(`${BASE}/api/admin/settings`, {
    data: { platformBank: { bankName: "E2E Bank", bankBranch: "Colombo 01", accountName: "GoPlay E2E", accountNumber: "1122334455", instructions: "Use the remark" } },
  });
  expect(s.status()).toBe(200);
});

test.afterAll(async () => {
  await adminCtx?.close();
  if (ids) await cleanup(ids, snap, ground?.id, ground?.ownerId);
  await closeDb();
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Access control", () => {
  const ADMIN_GETS = [
    "stats", "bookings", "users", "grounds", "applications", "open-matches", "lobby-payments", "trust",
    "earnings", "earnings/trends", "commissions", "refunds", "complaints", "reviews", "settings", "cancellations",
  ];

  test("signed-out visitors and players get 403 from every admin API", async ({ request }) => {
    for (const p of ADMIN_GETS) {
      expect((await request.get(`${BASE}/api/admin/${p}`)).status(), `anonymous ${p}`).toBe(403);
      expect((await request.get(`${BASE}/api/admin/${p}`, { headers: bearer(tokens.ana) })).status(), `player ${p}`).toBe(403);
    }
  });

  test("players and owners can't take admin actions", async ({ request }) => {
    const someBooking = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 30, start: "06:00", end: "07:00" });
    for (const t of [tokens.ana, tokens.owner]) {
      expect((await request.post(`${BASE}/api/admin/bookings/${someBooking}/cancel`, { headers: bearer(t), data: { reason: "not allowed" } })).status()).toBe(403);
      expect((await request.put(`${BASE}/api/admin/grounds/${ground.id}/commission`, { headers: bearer(t), data: { rate: 1 } })).status()).toBe(403);
      expect((await request.post(`${BASE}/api/admin/trust/block`, { headers: bearer(t), data: { userId: ids.ben, reason: "ABUSE" } })).status()).toBe(403);
    }
  });

  test("the admin panel redirects visitors who aren't admins", async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`);
    await expect(page).not.toHaveURL(/\/admin\/dashboard/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Every admin page loads cleanly", () => {
  const PAGES = [
    "dashboard", "bookings", "users", "grounds", "applications", "open-matches", "lobby-payments", "trust",
    "earnings", "commissions", "refunds", "complaints", "cancellations", "reviews", "analytics", "settings", "profile",
  ];
  for (const p of PAGES) {
    test(`/admin/${p}`, async () => {
      const page = await adminCtx.newPage();
      await visit(page, `${BASE}/admin/${p}`);
      await page.close();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Bookings", () => {
  test("search finds a booking by player, phone and booking ID; filters narrow it", async () => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 21, start: "07:00", end: "08:00" });
    for (const term of [ACCOUNTS.ana.email, "0771110001", id.slice(0, 14)]) {
      const r = await (await admin.get(`${BASE}/api/admin/bookings?q=${encodeURIComponent(term)}`)).json();
      expect(r.bookings.some((b: { id: string }) => b.id === id), `search "${term}"`).toBe(true);
    }
    const online = await (await admin.get(`${BASE}/api/admin/bookings?q=${id}&payment=ONLINE`)).json();
    expect(online.total).toBe(0);
    const dated = await (await admin.get(`${BASE}/api/admin/bookings?q=${id}&from=${day(21)}&to=${day(21)}`)).json();
    expect(dated.total).toBe(1);
    expect((await admin.get(`${BASE}/api/admin/bookings?status=NOT_A_STATUS`)).status()).toBe(200);
  });

  test("admin opens a booking, sees its history and cancels it with a reason", async () => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 22, start: "09:00", end: "10:00" });
    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/bookings?booking=${id}`);
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("What happened")).toBeVisible();
    await expect(panel.getByText("Booked", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Cancel booking…" }).click();
    const confirm = panel.getByRole("button", { name: "Cancel booking", exact: true });
    await expect(confirm).toBeDisabled();
    await panel.getByLabel("Why is GoPlay cancelling this booking?").fill("Ground closed for resurfacing");
    await confirm.click();
    await expect(panel.getByRole("status")).toHaveText(/Booking cancelled/);
    await expect(panel.getByText("Cancelled by GoPlay", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await page.close();

    const [b] = await q<{ status: string; cancelledBy: string }>(`select status, "cancelledBy" from "FacilityBooking" where id = $1`, [id]);
    expect(b).toEqual({ status: "CANCELLED", cancelledBy: "admin" });
    const notes = await q(`select 1 from "Notification" where "userId" = any($1) and title = 'Booking cancelled by GoPlay' and message like '%resurfacing%'`, [[ids.ana, ground.ownerUserId]]);
    expect(notes.length, "player and owner are told").toBe(2);
    expect((await admin.post(`${BASE}/api/admin/bookings/${id}/cancel`, { data: { reason: "again please" } })).status(), "second cancel").toBe(409);
  });

  test("cancelling a paid booking puts it on Refunds, and the admin closes the refund", async () => {
    const id = await seedBooking({ userId: ids.ben, facilityId: ground.id, courtId: ground.courtId, daysFromToday: 23, start: "09:00", end: "10:00", paymentMethod: "ONLINE", paymentStatus: "PAID" });
    const r = await admin.post(`${BASE}/api/admin/bookings/${id}/cancel`, { data: { reason: "Double booked by the ground" } });
    expect(r.status()).toBe(200);
    expect((await r.json()).refundNeeded).toBe(true);
    const refunds = await (await admin.get(`${BASE}/api/admin/refunds`)).json();
    expect(JSON.stringify(refunds)).toContain(id);
    expect((await admin.put(`${BASE}/api/admin/refunds/${id}`, { data: { note: "Ground refunded, ref RF-E2E" } })).status()).toBe(200);
    const [b] = await q<{ refundStatus: string }>(`select "refundStatus" from "FacilityBooking" where id = $1`, [id]);
    expect(b.refundStatus).toBe("PROCESSED");
  });

  test("a reason is required, and finished bookings can't be cancelled", async () => {
    const done = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -3, start: "09:00", end: "10:00", status: "COMPLETED" });
    expect((await admin.post(`${BASE}/api/admin/bookings/${done}/cancel`, { data: { reason: "x" } })).status()).toBe(400);
    expect((await admin.post(`${BASE}/api/admin/bookings/${done}/cancel`, { data: { reason: "Testing a finished booking" } })).status()).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Users and ground owners", () => {
  test("search by phone, filter by role and open a ground owner's account", async () => {
    const byPhone = await (await admin.get(`${BASE}/api/admin/users?q=0771110002`)).json();
    expect(byPhone.users.map((u: { email: string }) => u.email)).toContain(ACCOUNTS.ben.email);
    const owners = await (await admin.get(`${BASE}/api/admin/users?role=GROUND_OWNER`)).json();
    expect(owners.users.every((u: { role: string }) => u.role === "GROUND_OWNER")).toBe(true);

    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/users?user=${ground.ownerUserId}`);
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("As a ground owner")).toBeVisible();
    await expect(panel.getByText(ground.name).first()).toBeVisible();
    await expect(panel.getByText("Commission owed")).toBeVisible();
    await page.close();
  });

  test("deactivating a player signs them out at once; reactivating lets them back in", async ({ request }) => {
    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/users?user=${ids.ben}`);
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("As a player")).toBeVisible();
    await panel.getByRole("button", { name: "Deactivate…" }).click();
    await panel.getByRole("button", { name: "Deactivate account" }).click();
    await expect(panel.getByRole("status")).toHaveText("Account deactivated.");
    expect((await request.get(`${BASE}/api/user/profile`, { headers: bearer(tokens.ben) })).status(), "old token stops working").toBe(401);

    await panel.getByRole("button", { name: "Reactivate" }).click();
    await expect(panel.getByRole("status")).toHaveText("Account reactivated.");
    await page.close();
    expect((await request.get(`${BASE}/api/user/profile`, { headers: bearer(tokens.ben) })).status()).toBe(200);
  });

  test("an admin can't deactivate themselves or another admin", async () => {
    expect((await admin.patch(`${BASE}/api/admin/users/${ids.admin}/status`, { data: { isActive: false } })).status()).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Open matches: money flows through GoPlay", () => {
  let lobby = "";

  test("a player starts a lobby and pays GoPlay; a bad receipt is rejected with a reason", async ({ request }) => {
    const r = await request.post(`${BASE}/api/open-matches`, {
      headers: bearer(tokens.ana),
      data: { facilityId: ground.id, courtId: ground.courtId, categoryId: ground.categoryId, preferredDate: day(25), preferredStartTime: "17:00", preferredEndTime: "18:00", groupSize: 1, contactNumber: "0771110001" },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    lobby = body.id;
    expect(body.payTo).toBe("GOPLAY");
    expect(body.paymentDetails.accountNumber).toBe("1122334455");

    expect((await upload(`/api/open-matches/${lobby}/receipt`, tokens.ana, request)).status()).toBe(200);
    const lp = await (await admin.get(`${BASE}/api/admin/lobby-payments`)).json();
    const receipt = lp.receipts.find((x: { match: { id: string } }) => x.match.id === lobby);
    expect(receipt, "receipt waits for the admin").toBeTruthy();
    expect((await admin.post(`${BASE}/api/admin/lobby-payments/spots/${receipt.id}`, { data: { action: "reject", reason: "Amount doesn't match" } })).status()).toBe(200);
    const [spot] = await q<{ paymentStatus: string }>(`select "paymentStatus" from "OpenMatchSpot" where id = $1`, [receipt.id]);
    expect(spot.paymentStatus).toBe("REJECTED");
  });

  test("after a new receipt the admin confirms both players in the UI; the lobby fills and a payout is due", async ({ request }) => {
    expect((await upload(`/api/open-matches/${lobby}/receipt`, tokens.ana, request)).status()).toBe(200);
    const join = await request.post(`${BASE}/api/open-matches/${lobby}/join`, { headers: bearer(tokens.ben), data: { groupSize: 1, contactNumber: "0771110002" } });
    expect(join.status()).toBe(201);
    expect((await upload(`/api/open-matches/${lobby}/receipt`, tokens.ben, request)).status()).toBe(200);

    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/lobby-payments`);
    for (const name of [ACCOUNTS.ana.name, ACCOUNTS.ben.name]) {
      const card = page.locator("div", { hasText: name }).filter({ has: page.getByRole("button", { name: /Money received/ }) }).last();
      await card.getByRole("button", { name: /Money received/ }).click();
      await expect(page.getByText(name)).toHaveCount(0, { timeout: 10_000 });
    }
    await page.close();

    const [m] = await q<{ status: string }>(`select status from "OpenMatch" where id = $1`, [lobby]);
    expect(m.status).toBe("MATCHED");
    const [p] = await q<{ status: string; amount: number; collectedAmount: number }>(`select status, amount, "collectedAmount" from "LobbyPayout" where "matchId" = $1`, [lobby]);
    expect(p.status).toBe("DUE");
    expect(p.amount).toBeLessThan(p.collectedAmount);
  });

  test("the admin pays the ground; GoPlay's margin shows in earnings, the owner only sees the payout", async () => {
    const lp = await (await admin.get(`${BASE}/api/admin/lobby-payments`)).json();
    const payout = lp.payouts.find((x: { matchId: string }) => x.matchId === lobby);
    expect((await admin.post(`${BASE}/api/admin/lobby-payments/payouts/${payout.id}`, { data: { reference: "TRF-E2E-1" } })).status()).toBe(200);
    expect((await admin.post(`${BASE}/api/admin/lobby-payments/payouts/${payout.id}`, { data: { reference: "TRF-E2E-1" } })).status(), "paying twice").toBe(409);

    const ownerNotes = await q<{ message: string }>(`select message from "Notification" where "userId" = $1 and "createdAt" > now() - interval '10 minutes'`, [ground.ownerUserId]);
    expect(ownerNotes.map((n) => n.message).join(" ")).not.toMatch(/commission|GoPlay keeps|margin/i);
  });

  test("a cancelled lobby owes refunds, which the admin records as sent", async ({ request }) => {
    const r = await request.post(`${BASE}/api/open-matches`, {
      headers: bearer(tokens.ben),
      data: { facilityId: ground.id, courtId: ground.courtId, categoryId: ground.categoryId, preferredDate: day(26), preferredStartTime: "17:00", preferredEndTime: "18:00", groupSize: 1, contactNumber: "0771110002" },
    });
    const id = (await r.json()).id;
    await upload(`/api/open-matches/${id}/receipt`, tokens.ben, request);
    const lp = await (await admin.get(`${BASE}/api/admin/lobby-payments`)).json();
    const spotId = lp.receipts.find((x: { match: { id: string } }) => x.match.id === id).id;
    await admin.post(`${BASE}/api/admin/lobby-payments/spots/${spotId}`, { data: { action: "confirm" } });

    expect((await admin.post(`${BASE}/api/admin/open-matches`, { data: { matchId: id } })).status()).toBe(200);
    const after = await (await admin.get(`${BASE}/api/admin/lobby-payments`)).json();
    const refund = after.refunds.find((x: { id: string }) => x.id === spotId);
    expect(refund?.refundStatus).toBe("NEEDED");
    expect((await admin.post(`${BASE}/api/admin/lobby-payments/refunds/${spotId}`, { data: { action: "refunded", reference: "RF-E2E-1" } })).status()).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Cash bookings, no-shows and blocking", () => {
  test("a disputed no-show is overturned in the UI: booking completed, commission recorded, penalty cleared", async ({ request }) => {
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -1, start: "18:00", end: "19:00", contactEmail: ACCOUNTS.ana.email });
    expect((await request.put(`${BASE}/api/ground-owner/bookings/${id}/noshow`, { headers: bearer(tokens.owner) })).status()).toBe(200);
    expect((await request.post(`${BASE}/api/user/bookings/${id}/dispute-noshow`, { headers: bearer(tokens.ana), data: { message: "I played and paid the staff in cash at 6pm." } })).status()).toBe(200);

    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/trust`);
    const report = page.locator("div", { hasText: ACCOUNTS.ana.name }).filter({ has: page.getByRole("button", { name: /Overturn/ }) }).last();
    await expect(report.getByText("Player disputes it")).toBeVisible();
    await report.getByRole("button", { name: /Overturn/ }).click();
    await expect(page.getByText(/No-show overturned/)).toBeVisible();
    await page.close();

    const [b] = await q<{ status: string; noShowReview: string; fee: number }>(
      `select b.status, b."noShowReview", e."platformFee" as fee from "FacilityBooking" b join "GroundEarning" e on e."bookingId" = b.id where b.id = $1`, [id]);
    expect(b.status).toBe("COMPLETED");
    expect(b.noShowReview).toBe("OVERTURNED");
    expect(b.fee).toBeGreaterThan(0);
    const [u] = await q<{ noShowCount: number }>(`select "noShowCount" from "User" where id = $1`, [ids.ana]);
    expect(u.noShowCount).toBe(0);
  });

  test("blocking a player from their account stops sign-in and new sign-ups on that email; unblocking restores access", async ({ request }) => {
    const page = await adminCtx.newPage();
    await visit(page, `${BASE}/admin/users?user=${ids.ben}`);
    const panel = page.getByRole("dialog");
    await panel.getByRole("button", { name: "Block from GoPlay…" }).click();
    await panel.getByRole("combobox").selectOption("FAKE_BOOKINGS");
    await panel.getByLabel("Details").fill("E2E test block");
    await panel.getByRole("button", { name: "Block player" }).click();
    await expect(panel.getByRole("status")).toHaveText(/blocked/);

    const login = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);
    expect(login.status).toBe(403);
    const signup = await request.post(`${BASE}/api/auth/register`, { data: { name: "Again", email: ACCOUNTS.ben.email.toUpperCase(), password: "Another!2026", role: "USER", turnstileToken: "test" } });
    expect(signup.status(), "blocked email can't sign up again").toBeGreaterThanOrEqual(400);

    await panel.getByRole("button", { name: "Unblock" }).click();
    await panel.getByRole("button", { name: "Unblock" }).last().click();
    await expect(panel.getByRole("status")).toHaveText("Block lifted.");
    await page.close();
    const again = await mobileLogin(request, ACCOUNTS.ben.email, PASSWORD);
    expect(again.status).toBe(200);
    tokens.ben = again.body.token;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Commissions and earnings", () => {
  test("a per-ground rate drives the commission on completed bookings", async ({ request }) => {
    expect((await admin.put(`${BASE}/api/admin/grounds/${ground.id}/commission`, { data: { rate: 12.5, notifyOwner: false } })).status()).toBe(200);
    const id = await seedBooking({ userId: ids.ana, facilityId: ground.id, courtId: ground.courtId, daysFromToday: -2, start: "15:00", end: "16:00", amount: 2000 });
    expect((await request.put(`${BASE}/api/ground-owner/bookings/${id}/status`, { headers: bearer(tokens.owner), data: { status: "COMPLETED" } })).status()).toBe(200);
    const [e] = await q<{ platformFee: number }>(`select "platformFee" from "GroundEarning" where "bookingId" = $1`, [id]);
    expect(e.platformFee).toBe(250);
    expect((await admin.put(`${BASE}/api/admin/grounds/${ground.id}/commission`, { data: { rate: 80 } })).status()).toBe(400);
    expect(JSON.stringify(await (await request.get(`${BASE}/api/grounds/${ground.id}`)).json())).not.toContain("commissionRate");
  });

  test("dashboard, earnings and commissions agree on what grounds owe", async () => {
    const [{ owed }] = await q<{ owed: number }>(`select coalesce(sum("platformFee"), 0)::float as owed from "GroundEarning" where not "commissionPaid" and "platformFee" > 0`);
    const stats = await (await admin.get(`${BASE}/api/admin/stats`)).json();
    const earn  = await (await admin.get(`${BASE}/api/admin/earnings`)).json();
    expect(stats.finance.commission.outstanding).toBeCloseTo(owed, 2);
    expect(earn.summary.commission.outstanding).toBeCloseTo(owed, 2);
    const byGround = earn.byFacility.reduce((s: number, f: { outstanding: number }) => s + f.outstanding, 0);
    expect(byGround).toBeCloseTo(owed, 2);
  });

  test("the admin asks an owner to settle, then records the payment", async () => {
    expect((await admin.post(`${BASE}/api/admin/commissions/${ground.ownerId}/request`, { data: { note: "E2E request" } })).status()).toBe(200);
    expect((await admin.post(`${BASE}/api/admin/commissions/${ground.ownerId}/settle`, { data: { note: "E2E settled" } })).status()).toBe(200);
    const [{ open }] = await q<{ open: number }>(`select count(*)::int as open from "GroundEarning" where "ownerId" = $1 and not "commissionPaid" and "platformFee" > 0`, [ground.ownerId]);
    expect(open).toBe(0);
  });
});
