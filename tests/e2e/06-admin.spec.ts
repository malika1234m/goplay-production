import { test, expect } from "@playwright/test";
import { getFixtures } from "./helpers/api";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let groundId: string;

test.beforeAll(() => {
  groundId = getFixtures().groundId;
});

test.describe("Admin Dashboard Stats", () => {
  test("stats endpoint returns structured data", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/stats`);
    expect(res.status()).toBe(200);
    const { stats } = await res.json();
    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("activeGrounds");
    expect(stats).toHaveProperty("pendingGrounds");
    expect(stats).toHaveProperty("totalRevenue");
    expect(stats).toHaveProperty("monthlyRevenue");
    expect(typeof stats.totalUsers).toBe("number");
  });
});

test.describe("Admin User Management", () => {
  test("can list all users", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/users`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);
  });

  test("can search users by name or email", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/users?q=e2e`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
  });
});

test.describe("Admin Ground Management", () => {
  test("can list all grounds", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/grounds`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("grounds");
    expect(Array.isArray(body.grounds)).toBe(true);
  });

  test("can activate a ground", async ({ request }) => {
    const res = await request.put(`${BASE}/api/admin/grounds/${groundId}/status`, {
      data: { status: "ACTIVE" },
    });
    expect(res.status()).toBe(200);
    const { ground } = await res.json();
    expect(ground.status).toBe("ACTIVE");
  });

  test("can deactivate then reactivate a ground", async ({ request }) => {
    const off = await request.put(`${BASE}/api/admin/grounds/${groundId}/status`, {
      data: { status: "INACTIVE" },
    });
    expect(off.status()).toBe(200);
    expect((await off.json()).ground.status).toBe("INACTIVE");

    const on = await request.put(`${BASE}/api/admin/grounds/${groundId}/status`, {
      data: { status: "ACTIVE" },
    });
    expect(on.status()).toBe(200);
    expect((await on.json()).ground.status).toBe("ACTIVE");
  });

  test("can reject a ground", async ({ request, browser }) => {
    // Create a temporary ground using owner credentials, then reject it as admin
    const ownerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const ownerReq = ownerCtx.request;
    const createRes = await ownerReq.post(`${BASE}/api/ground-owner/grounds`, {
      data: {
        name:       `Reject Test Ground ${Date.now()}`,
        address:    "Reject Lane",
        city:       "Galle",
        hourlyRate: 300,
        categoryIds: [getFixtures().categoryId],
      },
    });
    expect(createRes.status()).toBe(201);
    const { ground: tempGround } = await createRes.json();
    await ownerCtx.close();

    const rejectRes = await request.put(`${BASE}/api/admin/grounds/${tempGround.id}/status`, {
      data: { status: "REJECTED" },
    });
    expect(rejectRes.status()).toBe(200);
    expect((await rejectRes.json()).ground.status).toBe("REJECTED");
  });
});

test.describe("Admin Applications", () => {
  test("can list provider applications", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/applications`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("applications");
    expect(body).toHaveProperty("summary");
    expect(body.summary).toHaveProperty("pending");
    expect(body.summary).toHaveProperty("approved");
  });

  test("can filter applications by status", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/applications?status=PENDING`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.applications)).toBe(true);
  });
});

test.describe("Admin Earnings", () => {
  test("can fetch earnings overview", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/earnings`);
    expect(res.status()).toBe(200);
  });

  test("can fetch earnings trends", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/earnings/trends`);
    expect(res.status()).toBe(200);
  });
});

test.describe("Admin Settings", () => {
  test("can read platform settings", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("commissionRate");
    expect(body).toHaveProperty("minPayout");
    expect(body).toHaveProperty("payoutCooldownDays");
  });

  test("can update commission rate", async ({ request }) => {
    const getRes = await request.get(`${BASE}/api/admin/settings`);
    const current = await getRes.json();
    const rate = Number(current.commissionRate);

    const res = await request.put(`${BASE}/api/admin/settings`, {
      data: { commissionRate: rate },
    });
    expect(res.status()).toBe(200);
  });

  test("rejects commission rate above 50%", async ({ request }) => {
    const res = await request.put(`${BASE}/api/admin/settings`, {
      data: { commissionRate: 99 },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects negative payout cooldown", async ({ request }) => {
    const res = await request.put(`${BASE}/api/admin/settings`, {
      data: { payoutCooldownDays: -1 },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Admin Reviews", () => {
  test("can fetch all reviews", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/reviews`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("reviews");
    expect(Array.isArray(body.reviews)).toBe(true);
  });
});

test.describe("Access Control", () => {
  test("regular user cannot access admin endpoints", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/user.json" });
    const req = ctx.request;
    const endpoints = [
      `${BASE}/api/admin/stats`,
      `${BASE}/api/admin/users`,
      `${BASE}/api/admin/grounds`,
      `${BASE}/api/admin/commissions`,
      `${BASE}/api/admin/settings`,
    ];
    for (const url of endpoints) {
      const res = await req.get(url);
      expect(res.status()).toBe(403);
    }
    await ctx.close();
  });

  test("ground owner cannot access admin endpoints", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/owner.json" });
    const req = ctx.request;
    const res = await req.get(`${BASE}/api/admin/stats`);
    expect(res.status()).toBe(403);
    await ctx.close();
  });
});

test.describe("Admin Pages", () => {
  test("admin dashboard renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin grounds page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/grounds`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin users page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin applications page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/applications`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin earnings page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/earnings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("admin settings page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});
