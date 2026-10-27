-- CreateEnum
CREATE TYPE "PointsEntryKind" AS ENUM ('ROUND', 'ACHIEVEMENT', 'REDEEM', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "RewardChannel" AS ENUM ('IN_STORE', 'ONLINE', 'BOTH');

-- CreateEnum
CREATE TYPE "RewardCodeStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED');

-- CreateTable
CREATE TABLE "game_points_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PointsEntryKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "game" VARCHAR(40),
    "achievementId" VARCHAR(60),
    "redemptionId" TEXT,
    "note" VARCHAR(200),
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_points_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_achievement_unlocks" (
    "userId" TEXT NOT NULL,
    "achievementId" VARCHAR(60) NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_achievement_unlocks_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "reward_cards" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300) NOT NULL DEFAULT '',
    "pointsCost" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "channel" "RewardChannel" NOT NULL DEFAULT 'IN_STORE',
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "limitPer30Days" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT,
    "title" VARCHAR(80) NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "channel" "RewardChannel" NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RewardCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_points_entries_userId_createdAt_idx" ON "game_points_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "game_points_entries_userId_kind_createdAt_idx" ON "game_points_entries"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "reward_cards_isActive_sortOrder_idx" ON "reward_cards"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_code_key" ON "reward_redemptions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_orderId_key" ON "reward_redemptions"("orderId");

-- CreateIndex
CREATE INDEX "reward_redemptions_userId_createdAt_idx" ON "reward_redemptions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_redemptions_cardId_userId_createdAt_idx" ON "reward_redemptions"("cardId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_redemptions_status_createdAt_idx" ON "reward_redemptions"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "game_points_entries" ADD CONSTRAINT "game_points_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_achievement_unlocks" ADD CONSTRAINT "game_achievement_unlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "reward_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

