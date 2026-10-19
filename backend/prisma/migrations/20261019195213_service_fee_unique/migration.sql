-- DropIndex
DROP INDEX "ServiceFee_type_validFrom_idx";

-- AlterTable
ALTER TABLE "ServiceFee" DROP COLUMN "validFrom",
DROP COLUMN "validTo";

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFee_type_key" ON "ServiceFee"("type");

