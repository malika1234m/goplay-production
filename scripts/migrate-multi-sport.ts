/**
 * Data migration: single categoryId → many-to-many categories
 *
 * Run BEFORE updating the schema and pushing to DB:
 *   npx tsx scripts/migrate-multi-sport.ts
 *
 * Then:
 *   npx prisma db push
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db      = new PrismaClient({ adapter });

async function main() {
  console.log("🔄  Migrating to multi-sport grounds…\n");

  // 1. Create the implicit many-to-many join table Prisma will expect
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_SportsCategoryToSportsFacility" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      CONSTRAINT "_SportsCategoryToSportsFacility_AB_pkey" PRIMARY KEY ("A","B")
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "_SportsCategoryToSportsFacility_B_index"
    ON "_SportsCategoryToSportsFacility"("B")
  `;
  console.log('✅  Join table "_SportsCategoryToSportsFacility" ready');

  // 2. Populate join table from existing categoryId values on SportsFacility
  const inserted: { count: bigint }[] = await db.$queryRaw`
    INSERT INTO "_SportsCategoryToSportsFacility" ("A","B")
    SELECT "categoryId","id"
    FROM   "SportsFacility"
    WHERE  "categoryId" IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING 1
  `;
  console.log(`✅  Migrated ${inserted.length} facility → category links`);

  // 3. Add categoryIds column to ProviderApplication (text array)
  await db.$executeRaw`
    ALTER TABLE "ProviderApplication"
    ADD COLUMN IF NOT EXISTS "categoryIds" TEXT[] DEFAULT '{}'
  `;
  console.log('✅  Added "categoryIds" column to ProviderApplication');

  // 4. Populate categoryIds from existing categoryId
  await db.$executeRaw`
    UPDATE "ProviderApplication"
    SET    "categoryIds" = ARRAY["categoryId"]
    WHERE  "categoryId" IS NOT NULL
  `;
  console.log('✅  Populated categoryIds from existing categoryId\n');

  console.log("Done! Now run:  npx prisma db push");
  console.log("(Prisma will drop the old categoryId columns — data is already migrated above.)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
