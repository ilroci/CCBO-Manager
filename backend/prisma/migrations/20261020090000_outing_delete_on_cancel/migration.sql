-- Annullare un'uscita ora la elimina: lo stato "annullata" non serve più.
-- AlterTable
ALTER TABLE "Outing" DROP COLUMN "status";

-- DropEnum
DROP TYPE "OutingStatus";
