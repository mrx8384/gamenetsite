-- AlterTable
ALTER TABLE "tournament_entries" ADD COLUMN     "kind" VARCHAR(12) NOT NULL DEFAULT 'PARTICIPANT';

-- AlterTable
ALTER TABLE "tournament_participants" ADD COLUMN     "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "liveNotice" VARCHAR(500),
ADD COLUMN     "reserveEnabled" BOOLEAN NOT NULL DEFAULT false;
