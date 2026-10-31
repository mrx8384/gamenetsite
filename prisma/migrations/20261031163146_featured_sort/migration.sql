-- DropIndex
DROP INDEX "products_isFeatured_idx";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "featuredSort" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_isFeatured_featuredSort_idx" ON "products"("isFeatured", "featuredSort");

-- Keep today's homepage order (newest edit first) as the starting order.
UPDATE "products" p SET "featuredSort" = s.rn
FROM (SELECT id, row_number() OVER (ORDER BY "updatedAt" DESC) AS rn FROM "products" WHERE "isFeatured") s
WHERE p.id = s.id;
