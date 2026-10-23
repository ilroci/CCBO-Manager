-- Giorni di noleggio addebitati a chi partecipa solo a una parte dell'uscita (null = tutta l'uscita).
-- AlterTable
ALTER TABLE "Rental" ADD COLUMN "chargedDays" INTEGER;
