-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL', 'GRAND_FINAL_RESET', 'THIRD_PLACE', 'ROUND_ROBIN', 'GROUP');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "game" VARCHAR(80) NOT NULL,
    "platform" VARCHAR(40),
    "description" VARCHAR(3000),
    "rules" VARCHAR(5000),
    "prize" VARCHAR(500),
    "entryFeeNote" VARCHAR(200),
    "startsAt" TIMESTAMP(3),
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "maxParticipants" INTEGER,
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT true,
    "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT false,
    "doubleRoundRobin" BOOLEAN NOT NULL DEFAULT false,
    "groupCount" INTEGER,
    "advancePerGroup" INTEGER,
    "knockoutStarted" BOOLEAN NOT NULL DEFAULT false,
    "pointsWin" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsLoss" INTEGER NOT NULL DEFAULT 0,
    "organizerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_participants" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "name" VARCHAR(60) NOT NULL,
    "seed" INTEGER NOT NULL,
    "groupIndex" INTEGER,
    "finalRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stage" "MatchStage" NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "groupIndex" INTEGER,
    "number" INTEGER NOT NULL,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "player1Bye" BOOLEAN NOT NULL DEFAULT false,
    "player2Bye" BOOLEAN NOT NULL DEFAULT false,
    "score1" INTEGER,
    "score2" INTEGER,
    "winnerId" TEXT,
    "winnerSlot" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "nextSlot" INTEGER,
    "loserMatchId" TEXT,
    "loserSlot" INTEGER,
    "note" VARCHAR(200),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_startsAt_idx" ON "tournaments"("status", "startsAt");

-- CreateIndex
CREATE INDEX "tournaments_organizerId_idx" ON "tournaments"("organizerId");

-- CreateIndex
CREATE INDEX "tournament_participants_tournamentId_seed_idx" ON "tournament_participants"("tournamentId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournamentId_userId_key" ON "tournament_participants"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournamentId_name_key" ON "tournament_participants"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "tournament_matches_tournamentId_stage_round_position_idx" ON "tournament_matches"("tournamentId", "stage", "round", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_tournamentId_number_key" ON "tournament_matches"("tournamentId", "number");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
