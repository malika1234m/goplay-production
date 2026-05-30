-- AddCommissionRequestFields
ALTER TABLE "GroundOwnerProfile" ADD COLUMN IF NOT EXISTS "commissionRequestedAt" TIMESTAMP(3);
ALTER TABLE "GroundOwnerProfile" ADD COLUMN IF NOT EXISTS "commissionRequestedAmount" DOUBLE PRECISION;
