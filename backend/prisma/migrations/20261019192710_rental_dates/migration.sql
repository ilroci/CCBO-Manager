/*
  Warnings:

  - You are about to drop the column `endAt` on the `Rental` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `Rental` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `Rental` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Rental` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Rental_memberId_startAt_idx";

-- DropIndex
DROP INDEX "Rental_status_idx";

-- AlterTable
ALTER TABLE "Rental" DROP COLUMN "endAt",
DROP COLUMN "startAt",
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "Rental_memberId_startDate_idx" ON "Rental"("memberId", "startDate");

-- CreateIndex
CREATE INDEX "Rental_status_startDate_endDate_idx" ON "Rental"("status", "startDate", "endDate");
