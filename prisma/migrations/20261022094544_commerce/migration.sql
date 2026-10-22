-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "priceOnRequest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentDeadline" TIMESTAMP(3);
