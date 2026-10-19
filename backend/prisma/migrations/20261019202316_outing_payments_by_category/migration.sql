-- CreateEnum
CREATE TYPE "CollectionCategory" AS ENUM ('RENTAL', 'TRANSPORT', 'VAN');

-- DropForeignKey
ALTER TABLE "OutingParticipant" DROP CONSTRAINT "OutingParticipant_paidConfirmedById_fkey";

-- AlterTable
ALTER TABLE "Outing" DROP COLUMN "fuelCost",
DROP COLUMN "tollCost";

-- AlterTable
ALTER TABLE "OutingParticipant" DROP COLUMN "expensesShare",
DROP COLUMN "paidAt",
DROP COLUMN "paidConfirmedById",
DROP COLUMN "paymentStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "OutingPayment" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "category" "CollectionCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,

    CONSTRAINT "OutingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutingPayment_participantId_category_key" ON "OutingPayment"("participantId", "category");

-- AddForeignKey
ALTER TABLE "OutingPayment" ADD CONSTRAINT "OutingPayment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "OutingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingPayment" ADD CONSTRAINT "OutingPayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

