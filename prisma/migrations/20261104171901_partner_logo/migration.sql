-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "logoId" TEXT,
ADD COLUMN     "logoRejectReason" VARCHAR(300),
ADD COLUMN     "logoSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "pendingLogoId" TEXT;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_pendingLogoId_fkey" FOREIGN KEY ("pendingLogoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
