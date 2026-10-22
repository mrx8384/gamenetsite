-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('PREPAID', 'COLLECT');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingMethodId" TEXT,
ADD COLUMN     "shippingMethodName" VARCHAR(100),
ADD COLUMN     "shippingType" "ShippingType",
ADD COLUMN     "trackingCode" VARCHAR(100),
ADD COLUMN     "trackingUrl" VARCHAR(300);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "type" "ShippingType" NOT NULL,
    "price" BIGINT NOT NULL DEFAULT 0,
    "trackingUrl" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_price_chk" CHECK ("price" >= 0 AND ("type" = 'PREPAID' OR "price" = 0));
