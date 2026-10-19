/*
  Warnings:

  - You are about to drop the column `unit` on the `Rental` table. All the data in the column will be lost.
  - You are about to drop the column `lineTotal` on the `RentalItem` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `RentalItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `RentalItem` table. All the data in the column will be lost.
  - You are about to drop the `PriceListEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "EquipmentCategory" ADD VALUE 'LIFE_JACKET';

-- DropForeignKey
ALTER TABLE "PriceListEntry" DROP CONSTRAINT "PriceListEntry_updatedById_fkey";

-- AlterTable
ALTER TABLE "Rental" DROP COLUMN "unit";

-- AlterTable
ALTER TABLE "RentalItem" DROP COLUMN "lineTotal",
DROP COLUMN "quantity",
DROP COLUMN "unitPrice";

-- DropTable
DROP TABLE "PriceListEntry";

-- DropEnum
DROP TYPE "PricingUnit";

-- CreateTable
CREATE TABLE "RentalOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categories" "EquipmentCategory"[],
    "dailyPrice" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCharge" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "optionId" TEXT,
    "name" TEXT NOT NULL,
    "dailyPrice" DECIMAL(10,2) NOT NULL,
    "days" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RentalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentalOption_name_key" ON "RentalOption"("name");

-- CreateIndex
CREATE INDEX "RentalCharge_rentalId_idx" ON "RentalCharge"("rentalId");

-- AddForeignKey
ALTER TABLE "RentalOption" ADD CONSTRAINT "RentalOption_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "RentalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
