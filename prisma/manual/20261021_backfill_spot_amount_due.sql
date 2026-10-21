-- Lobby spots created before "amountDue" existed have amountDue = 0 but real money in amountPaid.
-- Refunds and payouts are worked out from what a spot sent, so give those spots their real amount.
-- Safe to run more than once. Run AFTER `prisma db push` for the October 2026 health fixes.
BEGIN;
UPDATE "OpenMatchSpot"
   SET "amountDue" = "amountPaid", "updatedAt" = now()
 WHERE "amountDue" = 0 AND "amountPaid" > 0;
COMMIT;
