/**
 * Fixtures for the admin operations suite (07-admin-operations.spec.ts).
 *
 * The suite drives the real APIs and pages. The database is touched directly only for what no API
 * can do: creating the test accounts (sign-up needs a CAPTCHA and an email code) and seeding bookings
 * dated in the past (a player can't book yesterday). Everything is tagged so cleanup removes exactly
 * what the run created. Runs against a LOCAL server and database only.
 */
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import { Pool, types } from "pg";

// Money columns are NUMERIC; read them as numbers like the app does (pg returns strings by default)
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));
import bcrypt from "bcryptjs";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

export function assertLocal() {
  const db = env("DATABASE_URL") ?? "";
  const local = (u: string) => /(^|@|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);
  if (!local(BASE) || !local(db)) {
    throw new Error("The admin operations suite seeds and deletes data. It only runs against a local server and a local database.");
  }
}

let pool: Pool | null = null;
export function db() {
  if (!pool) pool = new Pool({ connectionString: env("DATABASE_URL"), max: 2 });
  return pool;
}
export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(sql, params)).rows as T[];
}
export async function closeDb() { await pool?.end(); pool = null; }

/** Marker on everything the suite creates. */
/** Lets tests call cron routes on the local server (CRON_SECRET in the local .env). */
export const cronSecret = () => env("CRON_SECRET");

export const TAG = "e2eadm";
export const PASSWORD = "E2eAdmin!2026";
export const ACCOUNTS = {
  admin:  { email: `${TAG}-admin@goplay.test`,  name: "E2E Admin",  role: "ADMIN" },
  ana:    { email: `${TAG}-ana@goplay.test`,    name: "E2E Ana",    role: "USER", phone: "0771110001" },
  ben:    { email: `${TAG}-ben@goplay.test`,    name: "E2E Ben",    role: "USER", phone: "0771110002" },
} as const;

/** The seeded demo ground the suite books against, and its owner (from prisma/seed). */
export const GROUND = { name: "Kandy Hills Tennis Club" };
export const OWNER  = { email: "owner@goplay.lk", password: process.env.TEST_SEED_OWNER_PASSWORD ?? "Owner@GoPlay25" };

const cuid = () => `${TAG}${randomBytes(9).toString("hex")}`;

export async function seedAccounts() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<keyof typeof ACCOUNTS, string> = { admin: "", ana: "", ben: "" };
  for (const [k, a] of Object.entries(ACCOUNTS) as [keyof typeof ACCOUNTS, (typeof ACCOUNTS)[keyof typeof ACCOUNTS]][]) {
    const id = `${TAG}-${k}`;
    await q(
      `insert into "User" (id, name, email, password, role, phone, "isActive", "emailVerifiedAt", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, true, now(), now(), now())
       on conflict (email) do update set password = excluded.password, "isActive" = true, "noShowCount" = 0, "cashCancelCount" = 0,
         "requiresOnlinePayment" = false, "isBookingSuspended" = false, "sessionsValidAfter" = null`,
      [id, a.name, a.email, hash, a.role, "phone" in a ? a.phone : null],
    );
    ids[k] = (await q<{ id: string }>(`select id from "User" where email = $1`, [a.email]))[0].id;
  }
  return ids;
}

export async function groundFixture() {
  const [g] = await q<{ id: string; ownerId: string; hourlyRate: number; ownerUserId: string }>(
    `select f.id, f."ownerId", f."hourlyRate", o."userId" as "ownerUserId" from "SportsFacility" f join "GroundOwnerProfile" o on o.id = f."ownerId" where f.name = $1`,
    [GROUND.name],
  );
  if (!g) throw new Error(`Seed ground "${GROUND.name}" not found. Run the seed first.`);
  const [court] = await q<{ id: string }>(`select id from "FacilityCourt" where "facilityId" = $1 and "isActive" order by "sortOrder", "createdAt" limit 1`, [g.id]);
  // Implicit many-to-many: "A" is the category, "B" the facility
  const [cat]   = await q<{ id: string; minPlayers: number }>(
    `select c.id, c."minPlayers" from "SportsCategory" c join "_SportsCategoryToSportsFacility" fc on fc."A" = c.id where fc."B" = $1 limit 1`, [g.id],
  );
  return { ...g, courtId: court?.id ?? null, categoryId: cat.id, minPlayers: cat.minPlayers };
}

/** A booking that no API can create: e.g. dated yesterday, or already paid. */
export async function seedBooking(o: {
  userId: string; facilityId: string; courtId: string | null; daysFromToday: number; start: string; end: string;
  status?: string; paymentMethod?: "ON_ARRIVAL" | "ONLINE"; paymentStatus?: string; amount?: number; contactEmail?: string;
}) {
  const id = cuid();
  await q(
    `insert into "FacilityBooking" (id, "userId", "facilityId", "courtId", "bookingDate", "startTime", "endTime", "totalHours", "totalAmount",
       status, "paymentMethod", "paymentStatus", "contactNumber", "contactEmail", "createdAt", "updatedAt")
     values ($1, $2, $3, $4, current_date + $5::int, $6, $7, 1, $8, $9, $10, $11, '0771110001', $12, now(), now())`,
    [id, o.userId, o.facilityId, o.courtId, o.daysFromToday, o.start, o.end, o.amount ?? 2500,
     o.status ?? "CONFIRMED", o.paymentMethod ?? "ON_ARRIVAL", o.paymentStatus ?? "PENDING", o.contactEmail ?? null],
  );
  return id;
}

/** Remembers settings the suite changes, so cleanup can put them back. */
export async function snapshot(facilityId: string, ownerProfileId: string) {
  const bank = await q<{ key: string; value: string }>(`select key, value from "PlatformSetting" where key like 'platformBank%'`);
  const [rate] = await q<{ commissionRate: number | null }>(`select "commissionRate" from "SportsFacility" where id = $1`, [facilityId]);
  const unpaid = await q<{ id: string }>(`select id from "GroundEarning" where "ownerId" = $1 and not "commissionPaid"`, [ownerProfileId]);
  const [req]  = await q<{ a: number | null; at: Date | null }>(`select "commissionRequestedAmount" as a, "commissionRequestedAt" as at from "GroundOwnerProfile" where id = $1`, [ownerProfileId]);
  return { bank, rate: rate?.commissionRate ?? null, unpaid: unpaid.map((r) => r.id), request: req };
}

export async function cleanup(ids: Record<string, string>, snap: Awaited<ReturnType<typeof snapshot>> | null, facilityId?: string, ownerProfileId?: string) {
  const users = Object.values(ids).filter(Boolean);
  const matches = (await q<{ id: string }>(`select distinct "matchId" as id from "OpenMatchSpot" where "userId" = any($1)`, [users])).map((r) => r.id);
  const bookings = (await q<{ id: string }>(
    `select id from "FacilityBooking" where "userId" = any($1) or "openMatchId" = any($2) or id like $3`, [users, matches, `${TAG}%`],
  )).map((r) => r.id);
  await q(`delete from "GroundEarning" where "bookingId" = any($1)`, [bookings]);
  await q(`delete from "PaymentComplaint" where "bookingId" = any($1)`, [bookings]).catch(() => undefined);
  await q(`delete from "FacilityBooking" where id = any($1)`, [bookings]);
  await q(`delete from "LobbyPayout" where "matchId" = any($1)`, [matches]);
  await q(`delete from "OpenMatchSpot" where "matchId" = any($1)`, [matches]);
  await q(`delete from "OpenMatch" where id = any($1)`, [matches]);
  await q(`delete from "Notification" where "userId" = any($1)`, [users]);
  await q(`delete from "Notification" where message like '%E2E Ana%' or message like '%E2E Ben%' or message like $1`, [`%${TAG}%`]);
  await q(`delete from "AccountBlock" where "userId" = any($1) or email like $2`, [users, `${TAG}-%`]);
  await q(`delete from "EmailVerification" where "userId" = any($1)`, [users]).catch(() => undefined);
  await q(`delete from "User" where id = any($1)`, [users]);
  await q(`delete from "RateLimit"`).catch(() => undefined);
  if (snap && facilityId && ownerProfileId) {
    await q(`delete from "PlatformSetting" where key like 'platformBank%'`);
    for (const r of snap.bank) await q(`insert into "PlatformSetting" (key, value, "updatedAt") values ($1, $2, now())`, [r.key, r.value]);
    await q(`update "SportsFacility" set "commissionRate" = $1 where id = $2`, [snap.rate, facilityId]);
    await q(`update "GroundEarning" set "commissionPaid" = false, "commissionSettledAt" = null where id = any($1)`, [snap.unpaid]);
    await q(`update "GroundOwnerProfile" set "commissionRequestedAmount" = $1, "commissionRequestedAt" = $2 where id = $3`, [snap.request?.a ?? null, snap.request?.at ?? null, ownerProfileId]);
  }
}
