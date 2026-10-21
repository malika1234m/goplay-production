import { test, expect } from "@playwright/test";
import { getFixtures, futureDate } from "./helpers/api";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let groundId: string;
let categoryId: string;

test.beforeAll(() => {
  const f = getFixtures();
  groundId   = f.groundId;
  categoryId = f.categoryId;
});

test.describe("Ground CRUD", () => {
  test("owner can list their grounds", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/grounds`);
    expect(res.status()).toBe(200);
    const { grounds } = await res.json();
    expect(Array.isArray(grounds)).toBe(true);
    expect(grounds.some((g: { id: string }) => g.id === groundId)).toBe(true);
  });

  test("owner can create a new ground (status = PENDING)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/ground-owner/grounds`, {
      data: {
        name:       `New Ground ${Date.now()}`,
        address:    "99 Test Street",
        city:       "Kandy",
        hourlyRate: 800,
        capacity:   11,
        categoryIds: [categoryId],
      },
    });
    expect(res.status()).toBe(201);
    const { ground } = await res.json();
    expect(ground.status).toBe("PENDING");
    expect(ground.name).toContain("New Ground");
  });

  test("creation fails without required fields", async ({ request }) => {
    const res = await request.post(`${BASE}/api/ground-owner/grounds`, {
      data: { name: "Incomplete" },
    });
    expect(res.status()).toBe(400);
  });

  test("owner can update ground details", async ({ request }) => {
    const res = await request.put(`${BASE}/api/ground-owner/grounds/${groundId}`, {
      data: { name: "Updated E2E Ground", hourlyRate: 600, categoryId },
    });
    expect(res.status()).toBe(200);
    const { ground } = await res.json();
    expect(ground.hourlyRate).toBe(600);

    // Restore original values
    await request.put(`${BASE}/api/ground-owner/grounds/${groundId}`, {
      data: { name: "E2E Test Cricket Ground", hourlyRate: 500, categoryId },
    });
  });

  test("owner can fetch a single ground by ID", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/grounds/${groundId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ground ?? body).toHaveProperty("id", groundId);
  });
});

test.describe("Bookings Management", () => {
  test("owner can view bookings for their grounds", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/bookings`);
    expect(res.status()).toBe(200);
    const { bookings } = await res.json();
    expect(Array.isArray(bookings)).toBe(true);
  });

  test("owner can add a walk-in booking (CONFIRMED immediately)", async ({ request }) => {
    const date = futureDate(12);
    const res = await request.post(`${BASE}/api/ground-owner/bookings`, {
      data: {
        facilityId:    groundId,
        bookingDate:   date,
        startTime:     "15:00",
        endTime:       "17:00",
        playerName:    "Walk-in Test Player",
        contactNumber: "0779876543",
      },
    });
    expect(res.status()).toBe(201);
    const { booking } = await res.json();
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.paymentMethod).toBe("ON_ARRIVAL");
  });

  test("walk-in booking fails without playerName", async ({ request }) => {
    const res = await request.post(`${BASE}/api/ground-owner/bookings`, {
      data: {
        facilityId:  groundId,
        bookingDate: futureDate(13),
        startTime:   "10:00",
        endTime:     "11:00",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("owner can change booking status", async ({ request }) => {
    // First create a walk-in booking to manage
    const createRes = await request.post(`${BASE}/api/ground-owner/bookings`, {
      data: {
        facilityId:  groundId,
        bookingDate: futureDate(20),
        startTime:   "09:00",
        endTime:     "10:00",
        playerName:  "Status Test Player",
      },
    });
    expect(createRes.status()).toBe(201);
    const { booking } = await createRes.json();

    // Cancel it
    const cancelRes = await request.put(`${BASE}/api/ground-owner/bookings/${booking.id}/status`, {
      data: { status: "CANCELLED" },
    });
    expect(cancelRes.status()).toBe(200);
    const body = await cancelRes.json();
    expect(body.booking.status).toBe("CANCELLED");
  });
});

test.describe("Blocked Dates", () => {
  test("owner can block a full day", async ({ request }) => {
    const date = futureDate(30);
    const res = await request.post(`${BASE}/api/ground-owner/blocked-dates`, {
      data: { facilityId: groundId, date, reason: "E2E maintenance test" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.entry).toBeDefined();
    expect(body.entry.reason).toBe("E2E maintenance test");

    // Clean up
    const delRes = await request.delete(
      `${BASE}/api/ground-owner/blocked-dates/${body.entry.id}`
    );
    expect(delRes.status()).toBe(200);
  });

  test("owner can list blocked dates", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/blocked-dates`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("blocked");
    expect(Array.isArray(body.blocked)).toBe(true);
  });
});

test.describe("Earnings & Stats", () => {
  test("owner can view earnings list", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/earnings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("byFacility");
    expect(Array.isArray(body.byFacility)).toBe(true);
  });

  test("owner can view earnings trends", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/earnings/trends`);
    expect(res.status()).toBe(200);
  });

  test("owner can view their stats", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ground-owner/stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("stats");
  });
});

test.describe("Ground Owner Pages", () => {
  test("dashboard renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/dashboard`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("bookings page renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/bookings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("grounds page renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/grounds`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });

  test("earnings page renders", async ({ page }) => {
    await page.goto(`${BASE}/ground-owner/earnings`);
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  });
});
