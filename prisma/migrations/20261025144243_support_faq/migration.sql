-- CreateTable
CREATE TABLE "support_faqs" (
    "id" TEXT NOT NULL,
    "question" VARCHAR(200) NOT NULL,
    "answer" VARCHAR(2000) NOT NULL,
    "keywords" VARCHAR(300) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_faqs_isActive_sortOrder_idx" ON "support_faqs"("isActive", "sortOrder");
