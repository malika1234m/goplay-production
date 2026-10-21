import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  // One instance serves many concurrent requests (Vercel Fluid compute), so a pool of 1
  // queues every query behind the one before it — under load that is what stalls the API.
  // DATABASE_URL goes through Neon's pgbouncer pooler, which absorbs many client connections.
  const pool = new Pool({
    connectionString:  process.env.DATABASE_URL!,
    max:               Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 5_000,
  });
  // Releases idle clients before the instance is suspended, so a bigger pool can't leak connections
  attachDatabasePool(pool);
  const adapter = new PrismaPg(pool);
  // A ground's commission rate is GoPlay-internal: hidden from every query unless one asks for it
  // with `select: { commissionRate: true }` or `omit: { commissionRate: false }` (admin and earnings code).
  return new PrismaClient({ adapter, omit: { sportsFacility: { commissionRate: true } } });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
