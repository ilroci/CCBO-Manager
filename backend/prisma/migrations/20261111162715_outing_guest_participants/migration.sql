-- AlterTable
ALTER TABLE "OutingParticipant" ADD COLUMN     "guestFirstName" TEXT,
ADD COLUMN     "guestLastName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Rental" ALTER COLUMN "memberId" DROP NOT NULL;
