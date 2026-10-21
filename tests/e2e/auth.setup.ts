import { test as setup, expect, type Page, type APIRequestContext } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { AUTH_DIR } from "../../playwright.config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    ?? "admin@goplay.lk";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "password123";
const USER_EMAIL     = process.env.TEST_USER_EMAIL     ?? `e2e_user_${Date.now()}@goplay.test`;
const USER_PASSWORD  = "TestUser123!";
const OWNER_EMAIL    = process.env.TEST_OWNER_EMAIL    ?? `e2e_owner_${Date.now()}@goplay.test`;
const OWNER_PASSWORD = "TestOwner123!";

const USER_STATE  = path.join(AUTH_DIR, "user.json");
const OWNER_STATE = path.join(AUTH_DIR, "owner.json");
const ADMIN_STATE = path.join(AUTH_DIR, "admin.json");
const FIXTURES    = path.join(AUTH_DIR, "fixtures.json");

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function registerAccount(
  request: APIRequestContext,
  name: string,
  email: string,
  password: string,
  role: "USER" | "GROUND_OWNER"
) {
  const res = await request.post(`${BASE}/api/auth/register`, {
    data: { name, email, password, role },
  });
  // 201 = created, 409 = already exists — both are fine for idempotent setup
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(`Registration failed (${res.status()}): ${await res.text()}`);
  }
}

async function loginAndSaveState(page: Page, email: string, password: string, statePath: string) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.context().storageState({ path: statePath });
}

setup("create test accounts and save auth states", async ({ page, request }) => {
  ensureAuthDir();

  // 1. Register test USER (idempotent)
  await registerAccount(request, "E2E Test User", USER_EMAIL, USER_PASSWORD, "USER");

  // 2. Register test GROUND_OWNER (idempotent — also creates GroundOwnerProfile)
  await registerAccount(request, "E2E Test Owner", OWNER_EMAIL, OWNER_PASSWORD, "GROUND_OWNER");

  // 3. Save auth states for each role
  await loginAndSaveState(page, USER_EMAIL, USER_PASSWORD, USER_STATE);
  await loginAndSaveState(page, OWNER_EMAIL, OWNER_PASSWORD, OWNER_STATE);
  await loginAndSaveState(page, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE);

  // 4. Always create a fresh test ground (owned by the current owner) and activate it as admin.
  //    We recreate each run so the ground is always owned by the current owner.json account.
  const ownerCtx = await page.context().browser()!.newContext({ storageState: OWNER_STATE });
  const ownerReq = ownerCtx.request;

  const catRes = await ownerReq.get(`${BASE}/api/categories`);
  const { categories } = await catRes.json() as { categories: { id: string }[] };
  const categoryId  = categories[0].id;
  const categoryIds = [categoryId];

  const createRes = await ownerReq.post(`${BASE}/api/ground-owner/grounds`, {
    data: {
      name:       "E2E Test Cricket Ground",
      address:    "1 Test Lane, Colombo 07",
      city:       "Colombo",
      hourlyRate: 500,
      capacity:   22,
      categoryIds,
    },
  });
  expect(createRes.status()).toBe(201);
  const { ground } = await createRes.json() as { ground: { id: string } };
  await ownerCtx.close();

  // Admin context — activate the ground
  const adminCtx = await page.context().browser()!.newContext({ storageState: ADMIN_STATE });
  const adminReq = adminCtx.request;
  const activateRes = await adminReq.put(`${BASE}/api/admin/grounds/${ground.id}/status`, {
    data: { status: "ACTIVE" },
  });
  expect(activateRes.status()).toBe(200);
  await adminCtx.close();

  fs.writeFileSync(
    FIXTURES,
    JSON.stringify(
      { groundId: ground.id, categoryId, userEmail: USER_EMAIL, ownerEmail: OWNER_EMAIL },
      null,
      2
    )
  );
});
