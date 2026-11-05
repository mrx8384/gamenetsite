-- AlterEnum
ALTER TYPE "MatchStage" ADD VALUE 'SWISS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TournamentFormat" ADD VALUE 'SWISS';
ALTER TYPE "TournamentFormat" ADD VALUE 'LEADERBOARD';

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "grandFinal" VARCHAR(10) NOT NULL DEFAULT 'reset',
ADD COLUMN     "leaderboardRounds" INTEGER,
ADD COLUMN     "swissRounds" INTEGER,
ADD COLUMN     "tiebreak" VARCHAR(20) NOT NULL DEFAULT 'goal_difference';

-- CreateTable
CREATE TABLE "tournament_points" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_points_tournamentId_idx" ON "tournament_points"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_points_participantId_round_key" ON "tournament_points"("participantId", "round");

-- AddForeignKey
ALTER TABLE "tournament_points" ADD CONSTRAINT "tournament_points_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_points" ADD CONSTRAINT "tournament_points_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tournament_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
