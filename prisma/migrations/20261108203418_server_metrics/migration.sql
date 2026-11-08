-- CreateTable
CREATE TABLE "server_metrics" (
    "id" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seconds" INTEGER NOT NULL,
    "cpu" DOUBLE PRECISION NOT NULL,
    "load1" DOUBLE PRECISION NOT NULL,
    "memUsed" BIGINT NOT NULL,
    "memTotal" BIGINT NOT NULL,
    "swapUsed" BIGINT NOT NULL,
    "swapTotal" BIGINT NOT NULL,
    "diskUsed" BIGINT NOT NULL,
    "diskTotal" BIGINT NOT NULL,
    "netRx" BIGINT NOT NULL,
    "netTx" BIGINT NOT NULL,
    "appRss" BIGINT NOT NULL,

    CONSTRAINT "server_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_metrics_createdAt_idx" ON "server_metrics"("createdAt");
