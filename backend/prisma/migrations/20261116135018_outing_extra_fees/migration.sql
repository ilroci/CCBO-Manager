-- AlterEnum
ALTER TYPE "CollectionCategory" ADD VALUE 'EXTRA';

-- AlterTable
ALTER TABLE "OutingParticipant" ADD COLUMN     "extraAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OutingExtraFee" (
    "id" TEXT NOT NULL,
    "outingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutingExtraFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutingExtraFee_outingId_idx" ON "OutingExtraFee"("outingId");

-- AddForeignKey
ALTER TABLE "OutingExtraFee" ADD CONSTRAINT "OutingExtraFee_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingExtraFee" ADD CONSTRAINT "OutingExtraFee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
