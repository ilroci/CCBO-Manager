/*
  Warnings:

  - You are about to drop the column `endAt` on the `Outing` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `Outing` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `Outing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Outing` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Outing_startAt_idx";

-- AlterTable
ALTER TABLE "Outing" DROP COLUMN "endAt",
DROP COLUMN "startAt",
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "Outing_startDate_idx" ON "Outing"("startDate");
