-- CreateTable
CREATE TABLE "contract_organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logoId" TEXT,
    "description" VARCHAR(3000),
    "terms" VARCHAR(5000),
    "website" VARCHAR(300),
    "showDetails" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_organizations_isActive_sortOrder_idx" ON "contract_organizations"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "contract_organizations" ADD CONSTRAINT "contract_organizations_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
