/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `EquipmentItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EquipmentItem" DROP COLUMN "photoUrl";

-- CreateTable
CREATE TABLE "EquipmentPhoto" (
    "itemId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentPhoto_pkey" PRIMARY KEY ("itemId")
);

-- AddForeignKey
ALTER TABLE "EquipmentPhoto" ADD CONSTRAINT "EquipmentPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
