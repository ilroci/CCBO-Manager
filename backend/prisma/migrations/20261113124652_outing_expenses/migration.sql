-- CreateTable
CREATE TABLE "OutingExpense" (
    "id" TEXT NOT NULL,
    "outingId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutingExpense_outingId_idx" ON "OutingExpense"("outingId");

-- CreateIndex
CREATE INDEX "OutingExpense_payerId_idx" ON "OutingExpense"("payerId");

-- AddForeignKey
ALTER TABLE "OutingExpense" ADD CONSTRAINT "OutingExpense_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingExpense" ADD CONSTRAINT "OutingExpense_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "OutingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingExpense" ADD CONSTRAINT "OutingExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
