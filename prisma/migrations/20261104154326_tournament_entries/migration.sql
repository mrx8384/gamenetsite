-- CreateEnum
CREATE TYPE "TournamentEntryStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'CANCELLED', 'REFUND_NEEDED', 'REFUNDED');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "entryFee" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tournament_entries" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "tournamentName" VARCHAR(120) NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "TournamentEntryStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentDeadline" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "participantId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(300),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entries_paymentId_key" ON "tournament_entries"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entries_participantId_key" ON "tournament_entries"("participantId");

-- CreateIndex
CREATE INDEX "tournament_entries_tournamentId_status_idx" ON "tournament_entries"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "tournament_entries_userId_idx" ON "tournament_entries"("userId");

-- CreateIndex
CREATE INDEX "tournament_entries_status_paymentDeadline_idx" ON "tournament_entries"("status", "paymentDeadline");

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
