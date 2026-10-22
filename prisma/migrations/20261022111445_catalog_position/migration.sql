-- DropIndex
DROP INDEX "catalog_games_platform_createdAt_idx";

-- AlterTable
ALTER TABLE "catalog_games" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "catalog_games_platform_position_idx" ON "catalog_games"("platform", "position");
