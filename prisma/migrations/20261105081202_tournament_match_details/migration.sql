-- AlterTable
ALTER TABLE "tournament_matches" ADD COLUMN     "forfeit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "setScores" VARCHAR(120),
ADD COLUMN     "station" VARCHAR(40),
ADD COLUMN     "underwayAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tournament_participants" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "disqualifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "checkInMinutes" INTEGER;
