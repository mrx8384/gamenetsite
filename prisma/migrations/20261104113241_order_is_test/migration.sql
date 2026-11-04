-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Orders paid through Bale so far were all made with the test wallet token (WALLET-TEST-…, PROGRESS 48),
-- and sandbox orders exist only in development: mark both as test orders.
UPDATE "orders" SET "isTest" = true
WHERE "id" IN (SELECT "orderId" FROM "payments" WHERE "provider" IN ('bale', 'sandbox') AND "orderId" IS NOT NULL);
