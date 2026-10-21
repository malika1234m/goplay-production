import type { APIRequestContext } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { AUTH_DIR } from "../../../playwright.config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export function getFixtures(): Record<string, string> {
  const p = path.join(AUTH_DIR, "fixtures.json");
  if (!fs.existsSync(p)) {
    throw new Error("Test fixtures not found — run `npm run test:setup` first.");
  }
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, string>;
}

/** Returns a future date as YYYY-MM-DD, `daysAhead` days from today. */
export function futureDate(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

export async function createBooking(
  request: APIRequestContext,
  facilityId: string,
  bookingDate: string,
  startTime: string,
  endTime: string,
  contactNumber = "0771234567",
  paymentMethod: "ON_ARRIVAL" | "ONLINE" = "ON_ARRIVAL"
) {
  return request.post(`${BASE}/api/bookings`, {
    data: { facilityId, bookingDate, startTime, endTime, contactNumber, paymentMethod },
  });
}
