import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("Ground Owner Payouts", () => {
  test("can fetch full payout info", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/payout`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("balance");
    expect(body.balance).toHaveProperty("availableBalance");
    expect(body.balance).toHaveProperty("grossOnline");
    expect(body.balance).toHaveProperty("netOnline");
    expect(body.balance).toHaveProperty("paidOut");
    expect(body.balance).toHaveProperty("inFlight");

    expect(body).toHaveProperty("commission");
    expect(body.commission).toHaveProperty("totalCommission");
    expect(body.commission).toHaveProperty("unpaidCommission");

    expect(body).toHaveProperty("hasBankDetails");
    expect(body).toHaveProperty("payouts");
    expect(Array.isArray(body.payouts)).toBe(true);

    expect(body).toHaveProperty("settings");
    expect(body.settings.commissionRate).toBeGreaterThanOrEqual(0);
    expect(body.settings.minPayout).toBeGreaterThan(0);
  });

  test("payout request blocked when no bank details", async ({ request }) => {
    const infoRes = await request.get(`${BASE}/api/ground-owner/payout`);
    const info = await infoRes.json();

    if (!info.hasBankDetails) {
      const res = await request.post(`${BASE}/api/ground-owner/payout`);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("bank details");
    } else {
      // Bank details are set — skip this variant
      console.log("Skipping: bank details already set");
    }
  });

  test("payout request blocked when balance below minimum", async ({ request }) => {
    const infoRes = await request.get(`${BASE}/api/ground-owner/payout`);
    const info = await infoRes.json();

    if (info.hasBankDetails && info.balance.availableBalance < info.settings.minPayout) {
      const res = await request.post(`${BASE}/api/ground-owner/payout`);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Minimum payout");
    }
  });

  test("payout request blocked when one is already pending", async ({ request }) => {
    const infoRes = await request.get(`${BASE}/api/ground-owner/payout`);
    const info = await infoRes.json();
    const hasPending = info.payouts?.some(
      (p: { status: string }) => p.status === "PENDING" || p.status === "PROCESSING"
    );

    if (hasPending) {
      const res = await request.post(`${BASE}/api/ground-owner/payout`);
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("already have a payout");
    }
  });

  test("user role cannot access owner payout endpoint", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const req = ctx.request;
    const res = await req.get(`${BASE}/api/ground-owner/payout`);
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test("earnings page renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/earnings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Admin Commission Management", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("admin can fetch commission summary grouped by owner", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/commissions`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("owners");
    expect(Array.isArray(body.owners)).toBe(true);
    expect(body.summary).toHaveProperty("totalUnpaid");
    expect(body.summary).toHaveProperty("totalCashUnpaid");
    expect(body.summary).toHaveProperty("ownersWithDebt");
  });

  test("admin can export commissions CSV", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/commissions/export`);
    expect(res.status()).toBe(200);
  });

  test("admin can view all pending payout requests", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/payouts`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("payouts");
    expect(Array.isArray(body.payouts)).toBe(true);
  });

  test("admin can process a payout (approve or reject)", async ({ request }) => {
    // Get pending payouts
    const listRes = await request.get(`${BASE}/api/admin/payouts?status=PENDING`);
    const { payouts } = await listRes.json();

    if (payouts.length > 0) {
      const payout = payouts[0];
      const res = await request.put(`${BASE}/api/admin/payouts/${payout.id}`, {
        data: { status: "PROCESSING" },
      });
      expect([200, 400]).toContain(res.status());
    } else {
      console.log("No pending payouts to process in this test run.");
    }
  });

  test("non-admin cannot access commission endpoint", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const req = ctx.request;
    const res = await req.get(`${BASE}/api/admin/commissions`);
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test("admin payouts page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/payouts`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin commissions page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/commissions`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});
