-- CreateEnum
CREATE TYPE "StakeholderKind" AS ENUM ('PERSON', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "StakeholderStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateTable
CREATE TABLE "stakeholders" (
    "id" TEXT NOT NULL,
    "kind" "StakeholderKind" NOT NULL,
    "fullName" TEXT NOT NULL,
    "dni" TEXT,
    "ruc" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "position" TEXT,
    "institution" TEXT,
    "sector" TEXT,
    "graduationYear" INTEGER,
    "cycle" TEXT,
    "status" "StakeholderStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stakeholders_dni_key" ON "stakeholders"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "stakeholders_ruc_key" ON "stakeholders"("ruc");

-- CreateIndex
CREATE INDEX "stakeholders_status_idx" ON "stakeholders"("status");

-- CreateIndex
CREATE INDEX "stakeholders_fullName_idx" ON "stakeholders"("fullName");
