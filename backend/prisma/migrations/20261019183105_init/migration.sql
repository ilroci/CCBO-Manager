-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INSTRUCTOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('CANOE', 'PADDLE', 'HELMET', 'WATER_JACKET', 'SPRAY_DECK', 'WETSUIT');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'RENTED');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('HOURLY', 'DAILY', 'PER_OUTING');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('EQUIPMENT_TRANSPORT', 'VAN_SEAT');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('VAN', 'TRANSPORT_ONLY', 'AUTONOMOUS');

-- CreateEnum
CREATE TYPE "OutingStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalKind" AS ENUM ('PERSONAL', 'OUTING');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('RESERVED', 'ACTIVE', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT,
    "serialNumber" TEXT NOT NULL,
    "photoUrl" TEXT,
    "description" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListEntry" (
    "id" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFee" (
    "id" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "kind" "RentalKind" NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'RESERVED',
    "memberId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "participantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalItem" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnNote" TEXT,

    CONSTRAINT "RentalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "OutingStatus" NOT NULL DEFAULT 'PLANNED',
    "instructorId" TEXT NOT NULL,
    "vanSeats" INTEGER,
    "fuelCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tollCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutingParticipant" (
    "id" TEXT NOT NULL,
    "outingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "travelMode" "TravelMode" NOT NULL DEFAULT 'AUTONOMOUS',
    "rentalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transportAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vanSeatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expensesShare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidConfirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentItem_serialNumber_key" ON "EquipmentItem"("serialNumber");

-- CreateIndex
CREATE INDEX "EquipmentItem_category_status_idx" ON "EquipmentItem"("category", "status");

-- CreateIndex
CREATE INDEX "PriceListEntry_category_unit_validFrom_idx" ON "PriceListEntry"("category", "unit", "validFrom");

-- CreateIndex
CREATE INDEX "ServiceFee_type_validFrom_idx" ON "ServiceFee"("type", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_participantId_key" ON "Rental"("participantId");

-- CreateIndex
CREATE INDEX "Rental_memberId_startAt_idx" ON "Rental"("memberId", "startAt");

-- CreateIndex
CREATE INDEX "Rental_status_idx" ON "Rental"("status");

-- CreateIndex
CREATE INDEX "RentalItem_itemId_idx" ON "RentalItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalItem_rentalId_itemId_key" ON "RentalItem"("rentalId", "itemId");

-- CreateIndex
CREATE INDEX "Outing_startAt_idx" ON "Outing"("startAt");

-- CreateIndex
CREATE INDEX "Outing_instructorId_idx" ON "Outing"("instructorId");

-- CreateIndex
CREATE INDEX "OutingParticipant_memberId_idx" ON "OutingParticipant"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "OutingParticipant_outingId_memberId_key" ON "OutingParticipant"("outingId", "memberId");

-- AddForeignKey
ALTER TABLE "PriceListEntry" ADD CONSTRAINT "PriceListEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFee" ADD CONSTRAINT "ServiceFee_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "OutingParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingParticipant" ADD CONSTRAINT "OutingParticipant_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingParticipant" ADD CONSTRAINT "OutingParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingParticipant" ADD CONSTRAINT "OutingParticipant_paidConfirmedById_fkey" FOREIGN KEY ("paidConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
