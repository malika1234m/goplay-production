import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// These tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Registration", () => {
  test("creates a USER account", async ({ request }) => {
    const email = `reg_${Date.now()}@goplay.test`;
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "New Player", email, password: "Password123!", role: "USER" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("userId");
    expect(body.message).toContain("created");
  });

  test("creates a GROUND_OWNER account with profile", async ({ request }) => {
    const email = `owner_${Date.now()}@goplay.test`;
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "New Owner", email, password: "Password123!", role: "GROUND_OWNER" },
    });
    expect(res.status()).toBe(201);
  });

  test("rejects duplicate email", async ({ request }) => {
    const email = `dup_${Date.now()}@goplay.test`;
    await request.post(`${BASE}/api/auth/register`, {
      data: { name: "First", email, password: "Password123!" },
    });
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Second", email, password: "Password123!" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  test("rejects password shorter than 8 characters", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { name: "Bad", email: `short_${Date.now()}@goplay.test`, password: "abc" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("8 characters");
  });

  test("rejects missing required fields", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/register`, {
      data: { email: "no-name@goplay.test", password: "Password123!" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Login page", () => {
  test("renders correctly", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator("h1")).toContainText("Welcome back");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"]').fill("nobody@goplay.test");
    await page.locator('input[type="password"]').fill("WrongPass123!");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=Invalid email or password")).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated request to protected API returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/profile`);
    expect(res.status()).toBe(401);
  });

  test("unauthenticated request to admin API returns 401 or 403", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/stats`);
    expect([401, 403]).toContain(res.status());
  });
});
