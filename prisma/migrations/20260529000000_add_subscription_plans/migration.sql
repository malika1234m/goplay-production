-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "OwnerPaymentType" AS ENUM ('REGISTRATION_FEE', 'SUBSCRIPTION');

-- AlterTable: add subscription fields to GroundOwnerProfile
ALTER TABLE "GroundOwnerProfile" ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER';
ALTER TABLE "GroundOwnerProfile" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "GroundOwnerProfile" ADD COLUMN "isActivated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OwnerSubscription" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "type" "OwnerPaymentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payHereOrderId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerSubscription_payHereOrderId_key" ON "OwnerSubscription"("payHereOrderId");

-- CreateIndex
CREATE INDEX "OwnerSubscription_ownerId_idx" ON "OwnerSubscription"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerSubscription_payHereOrderId_idx" ON "OwnerSubscription"("payHereOrderId");

-- AddForeignKey
ALTER TABLE "OwnerSubscription" ADD CONSTRAINT "OwnerSubscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "GroundOwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
