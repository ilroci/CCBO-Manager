-- AlterEnum
BEGIN;
CREATE TYPE "OutingStatus_new" AS ENUM ('ACTIVE', 'CANCELLED');
ALTER TABLE "public"."Outing" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Outing" ALTER COLUMN "status" TYPE "OutingStatus_new" USING ("status"::text::"OutingStatus_new");
ALTER TYPE "OutingStatus" RENAME TO "OutingStatus_old";
ALTER TYPE "OutingStatus_new" RENAME TO "OutingStatus";
DROP TYPE "public"."OutingStatus_old";
ALTER TABLE "Outing" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "Outing" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

