-- AlterTable
ALTER TABLE "tournament_entries" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "members" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tournament_matches" ADD COLUMN     "claimAt" TIMESTAMP(3),
ADD COLUMN     "claimBySlot" INTEGER,
ADD COLUMN     "claimNote" VARCHAR(200),
ADD COLUMN     "claimScore1" INTEGER,
ADD COLUMN     "claimScore2" INTEGER,
ADD COLUMN     "claimSetScores" VARCHAR(120),
ADD COLUMN     "claimWinnerSlot" INTEGER;

-- AlterTable
ALTER TABLE "tournament_participants" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "members" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "allowPlayerReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPredictions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupQuestions" JSONB,
ADD COLUMN     "teamSize" INTEGER,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "tournament_co_organizers" (
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_co_organizers_pkey" PRIMARY KEY ("tournamentId","userId")
);

-- CreateTable
CREATE TABLE "tournament_waitlist" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "members" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_predictions" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_co_organizers_userId_idx" ON "tournament_co_organizers"("userId");

-- CreateIndex
CREATE INDEX "tournament_waitlist_tournamentId_createdAt_idx" ON "tournament_waitlist"("tournamentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_waitlist_tournamentId_userId_key" ON "tournament_waitlist"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "tournament_predictions_tournamentId_userId_idx" ON "tournament_predictions"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_predictions_matchId_userId_key" ON "tournament_predictions"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "tournament_co_organizers" ADD CONSTRAINT "tournament_co_organizers_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_co_organizers" ADD CONSTRAINT "tournament_co_organizers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_waitlist" ADD CONSTRAINT "tournament_waitlist_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_waitlist" ADD CONSTRAINT "tournament_waitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "tournament_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_predictions" ADD CONSTRAINT "tournament_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
