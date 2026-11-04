-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "showPartnerPrices" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "partnerPrice" BIGINT;
