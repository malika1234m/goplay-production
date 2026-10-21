-- Money columns from double precision to exact numeric (October 2026 health fixes, M9).
-- Rupee amounts become numeric(12,2); a ground's commission percent numeric(5,2); a payout's
-- commission fraction numeric(6,4). The app keeps returning plain numbers (src/lib/money-fields.ts).
--
-- Run this INSTEAD of letting `prisma db push` convert these columns (it refuses: lossy change),
-- then run `prisma db push` for the rest of the schema; it should report no changes for these.
-- 1. Run the SELECT on its own first and look at the rows: anything it lists is rounded to the cent.
-- 2. Then run the transaction below.

-- 1. Values that rounding would change (expect none, or sub-cent float noise)
SELECT 'GroundOwnerProfile.commissionRequestedAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("commissionRequestedAmount" - round("commissionRequestedAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "GroundOwnerProfile" WHERE "commissionRequestedAmount" IS NOT NULL AND "commissionRequestedAmount" <> round("commissionRequestedAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'SportsFacility.hourlyRate' AS "column", count(*) AS "rows changed by rounding", max(abs("hourlyRate" - round("hourlyRate"::numeric, 2)::double precision)) AS "largest change"
  FROM "SportsFacility" WHERE "hourlyRate" IS NOT NULL AND "hourlyRate" <> round("hourlyRate"::numeric, 2)::double precision
UNION ALL
SELECT 'SportsFacility.commissionRate' AS "column", count(*) AS "rows changed by rounding", max(abs("commissionRate" - round("commissionRate"::numeric, 2)::double precision)) AS "largest change"
  FROM "SportsFacility" WHERE "commissionRate" IS NOT NULL AND "commissionRate" <> round("commissionRate"::numeric, 2)::double precision
UNION ALL
SELECT 'FacilityBooking.totalAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("totalAmount" - round("totalAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "FacilityBooking" WHERE "totalAmount" IS NOT NULL AND "totalAmount" <> round("totalAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'FacilityBooking.refundAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("refundAmount" - round("refundAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "FacilityBooking" WHERE "refundAmount" IS NOT NULL AND "refundAmount" <> round("refundAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'ProviderApplication.proposedHourlyRate' AS "column", count(*) AS "rows changed by rounding", max(abs("proposedHourlyRate" - round("proposedHourlyRate"::numeric, 2)::double precision)) AS "largest change"
  FROM "ProviderApplication" WHERE "proposedHourlyRate" IS NOT NULL AND "proposedHourlyRate" <> round("proposedHourlyRate"::numeric, 2)::double precision
UNION ALL
SELECT 'GroundEarning.grossAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("grossAmount" - round("grossAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "GroundEarning" WHERE "grossAmount" IS NOT NULL AND "grossAmount" <> round("grossAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'GroundEarning.platformFee' AS "column", count(*) AS "rows changed by rounding", max(abs("platformFee" - round("platformFee"::numeric, 2)::double precision)) AS "largest change"
  FROM "GroundEarning" WHERE "platformFee" IS NOT NULL AND "platformFee" <> round("platformFee"::numeric, 2)::double precision
UNION ALL
SELECT 'GroundEarning.netAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("netAmount" - round("netAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "GroundEarning" WHERE "netAmount" IS NOT NULL AND "netAmount" <> round("netAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'OpenMatchSpot.amountPaid' AS "column", count(*) AS "rows changed by rounding", max(abs("amountPaid" - round("amountPaid"::numeric, 2)::double precision)) AS "largest change"
  FROM "OpenMatchSpot" WHERE "amountPaid" IS NOT NULL AND "amountPaid" <> round("amountPaid"::numeric, 2)::double precision
UNION ALL
SELECT 'OpenMatchSpot.amountDue' AS "column", count(*) AS "rows changed by rounding", max(abs("amountDue" - round("amountDue"::numeric, 2)::double precision)) AS "largest change"
  FROM "OpenMatchSpot" WHERE "amountDue" IS NOT NULL AND "amountDue" <> round("amountDue"::numeric, 2)::double precision
UNION ALL
SELECT 'OpenMatchSpot.refundAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("refundAmount" - round("refundAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "OpenMatchSpot" WHERE "refundAmount" IS NOT NULL AND "refundAmount" <> round("refundAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'LobbyPayout.collectedAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("collectedAmount" - round("collectedAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "LobbyPayout" WHERE "collectedAmount" IS NOT NULL AND "collectedAmount" <> round("collectedAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'LobbyPayout.courtAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("courtAmount" - round("courtAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "LobbyPayout" WHERE "courtAmount" IS NOT NULL AND "courtAmount" <> round("courtAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'LobbyPayout.commissionRate' AS "column", count(*) AS "rows changed by rounding", max(abs("commissionRate" - round("commissionRate"::numeric, 4)::double precision)) AS "largest change"
  FROM "LobbyPayout" WHERE "commissionRate" IS NOT NULL AND "commissionRate" <> round("commissionRate"::numeric, 4)::double precision
UNION ALL
SELECT 'LobbyPayout.commissionAmount' AS "column", count(*) AS "rows changed by rounding", max(abs("commissionAmount" - round("commissionAmount"::numeric, 2)::double precision)) AS "largest change"
  FROM "LobbyPayout" WHERE "commissionAmount" IS NOT NULL AND "commissionAmount" <> round("commissionAmount"::numeric, 2)::double precision
UNION ALL
SELECT 'LobbyPayout.amount' AS "column", count(*) AS "rows changed by rounding", max(abs("amount" - round("amount"::numeric, 2)::double precision)) AS "largest change"
  FROM "LobbyPayout" WHERE "amount" IS NOT NULL AND "amount" <> round("amount"::numeric, 2)::double precision;

-- 2. The conversion
BEGIN;
ALTER TABLE "GroundOwnerProfile" ALTER COLUMN "commissionRequestedAmount" TYPE numeric(12,2) USING round("commissionRequestedAmount"::numeric, 2);
ALTER TABLE "SportsFacility" ALTER COLUMN "hourlyRate" TYPE numeric(12,2) USING round("hourlyRate"::numeric, 2);
ALTER TABLE "SportsFacility" ALTER COLUMN "commissionRate" TYPE numeric(5,2) USING round("commissionRate"::numeric, 2);
ALTER TABLE "FacilityBooking" ALTER COLUMN "totalAmount" TYPE numeric(12,2) USING round("totalAmount"::numeric, 2);
ALTER TABLE "FacilityBooking" ALTER COLUMN "refundAmount" TYPE numeric(12,2) USING round("refundAmount"::numeric, 2);
ALTER TABLE "ProviderApplication" ALTER COLUMN "proposedHourlyRate" TYPE numeric(12,2) USING round("proposedHourlyRate"::numeric, 2);
ALTER TABLE "GroundEarning" ALTER COLUMN "grossAmount" TYPE numeric(12,2) USING round("grossAmount"::numeric, 2);
ALTER TABLE "GroundEarning" ALTER COLUMN "platformFee" TYPE numeric(12,2) USING round("platformFee"::numeric, 2);
ALTER TABLE "GroundEarning" ALTER COLUMN "netAmount" TYPE numeric(12,2) USING round("netAmount"::numeric, 2);
ALTER TABLE "OpenMatchSpot" ALTER COLUMN "amountPaid" TYPE numeric(12,2) USING round("amountPaid"::numeric, 2);
ALTER TABLE "OpenMatchSpot" ALTER COLUMN "amountDue" TYPE numeric(12,2) USING round("amountDue"::numeric, 2);
ALTER TABLE "OpenMatchSpot" ALTER COLUMN "refundAmount" TYPE numeric(12,2) USING round("refundAmount"::numeric, 2);
ALTER TABLE "LobbyPayout" ALTER COLUMN "collectedAmount" TYPE numeric(12,2) USING round("collectedAmount"::numeric, 2);
ALTER TABLE "LobbyPayout" ALTER COLUMN "courtAmount" TYPE numeric(12,2) USING round("courtAmount"::numeric, 2);
ALTER TABLE "LobbyPayout" ALTER COLUMN "commissionRate" TYPE numeric(6,4) USING round("commissionRate"::numeric, 4);
ALTER TABLE "LobbyPayout" ALTER COLUMN "commissionAmount" TYPE numeric(12,2) USING round("commissionAmount"::numeric, 2);
ALTER TABLE "LobbyPayout" ALTER COLUMN "amount" TYPE numeric(12,2) USING round("amount"::numeric, 2);
COMMIT;
