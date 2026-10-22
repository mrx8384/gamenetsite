-- DropIndex
DROP INDEX "partner_profiles_status_createdAt_idx";

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "partner_profiles_status_submittedAt_idx" ON "partner_profiles"("status", "submittedAt");
