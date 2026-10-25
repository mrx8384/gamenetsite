-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPPORT';

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadByStaff" INTEGER NOT NULL DEFAULT 0,
    "unreadByUser" INTEGER NOT NULL DEFAULT 0,
    "userLastSeenAt" TIMESTAMP(3),
    "staffNotifiedAt" TIMESTAMP(3),
    "customerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "fromStaff" BOOLEAN NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_userId_key" ON "support_conversations"("userId");

-- CreateIndex
CREATE INDEX "support_conversations_status_lastMessageAt_idx" ON "support_conversations"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "support_messages_conversationId_createdAt_idx" ON "support_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
