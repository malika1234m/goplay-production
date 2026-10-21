import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export const AUTH_DIR = path.resolve(__dirname, "tests/e2e/.auth");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    {
      name: "user-flows",
      testMatch: ["**/01-auth.spec.ts", "**/02-user-booking.spec.ts"],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "user.json"),
      },
    },
    {
      name: "owner-flows",
      testMatch: "**/03-ground-management.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "owner.json"),
      },
    },
    {
      name: "profile-flows",
      testMatch: "**/04-profile.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "user.json"),
      },
    },
    {
      name: "payout-flows",
      testMatch: "**/05-payouts-commissions.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "owner.json"),
      },
    },
    {
      // Self-contained: seeds its own accounts, needs no saved sign-ins
      name: "admin-ops",
      testMatch: "**/07-admin-operations.spec.ts",
      timeout: 60_000,
      use: { ...devices["Desktop Chrome"], channel: "chrome" }, // the installed Chrome, no browser download
    },
    {
      // Self-contained like admin-ops: the money and trust rules from the health report
      name: "integrity",
      testMatch: "**/08-integrity-fixes.spec.ts",
      timeout: 60_000,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "admin-flows",
      testMatch: "**/06-admin.spec.ts",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "admin.json"),
      },
    },
  ],
});
