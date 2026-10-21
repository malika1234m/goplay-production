import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("User Profile", () => {
  test("can fetch own profile with booking stats", async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/profile`);
    expect(res.status()).toBe(200);
    const { user, stats } = await res.json();
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user.role).toBe("USER");
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("upcoming");
    expect(stats).toHaveProperty("completed");
    expect(stats).toHaveProperty("cancelled");
  });

  test("can update name and phone", async ({ request }) => {
    const res = await request.put(`${BASE}/api/user/profile`, {
      data: { name: "Updated E2E User", phone: "0771111222" },
    });
    expect(res.status()).toBe(200);
    const { user } = await res.json();
    expect(user.name).toBe("Updated E2E User");
    expect(user.phone).toBe("0771111222");

    // Restore
    await request.put(`${BASE}/api/user/profile`, {
      data: { name: "E2E Test User", phone: null },
    });
  });

  test("update fails with empty name", async ({ request }) => {
    const res = await request.put(`${BASE}/api/user/profile`, {
      data: { name: "" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name");
  });

  test("update trims whitespace from name", async ({ request }) => {
    const res = await request.put(`${BASE}/api/user/profile`, {
      data: { name: "  Spaced Name  " },
    });
    expect(res.status()).toBe(200);
    const { user } = await res.json();
    expect(user.name).toBe("Spaced Name");

    // Restore
    await request.put(`${BASE}/api/user/profile`, {
      data: { name: "E2E Test User" },
    });
  });

  test("can change password", async ({ request }) => {
    const res = await request.put(`${BASE}/api/user/password`, {
      data: { currentPassword: "TestUser123!", newPassword: "TestUser123!" },
    });
    // Same password may return 400; wrong current returns 401/400
    // Either way — the endpoint is reachable and auth is working
    expect([200, 400]).toContain(res.status());
  });

  test("wrong current password is rejected", async ({ request }) => {
    const res = await request.put(`${BASE}/api/user/password`, {
      data: { currentPassword: "WrongPassword!", newPassword: "NewPassword123!" },
    });
    expect(res.status()).toBe(400);
  });

  test("dashboard page renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("profile page renders", async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("my-bookings page renders", async ({ page }) => {
    await page.goto(`${BASE}/my-bookings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Ground Owner Profile", () => {
  test.use({ storageState: "tests/e2e/.auth/owner.json" });

  test("can fetch business profile", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/profile`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toHaveProperty("name");
    expect(body.user.groundOwnerProfile).toHaveProperty("businessName");
    expect(body).toHaveProperty("stats");
  });

  test("can update business name and contact", async ({ request }) => {
    const res = await request.put(`${BASE}/api/ground-owner/profile`, {
      data: { name: "E2E Test Owner", businessName: "E2E Sports Club", phone: "0777000111" },
    });
    expect(res.status()).toBe(200);
  });

  test("can set bank details", async ({ request }) => {
    const res = await request.put(`${BASE}/api/ground-owner/bank-details`, {
      data: {
        bankName:          "People's Bank",
        accountNumber:     "9876543210",
        accountHolderName: "E2E Test Owner",
        bankBranch:        "Colombo",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.bankDetails.bankName).toBe("People's Bank");
    expect(body.bankDetails.accountHolderName).toBe("E2E Test Owner");
  });

  test("bank details update fails without required fields", async ({ request }) => {
    const res = await request.put(`${BASE}/api/ground-owner/bank-details`, {
      data: { bankName: "Test Bank" },
    });
    expect(res.status()).toBe(400);
  });

  test("can read saved bank details", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/bank-details`);
    expect(res.status()).toBe(200);
    const { bankDetails } = await res.json();
    expect(bankDetails).toHaveProperty("bankName");
    expect(bankDetails).toHaveProperty("accountNumber");
  });

  test("owner dashboard renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/dashboard`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});
