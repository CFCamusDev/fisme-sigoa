-- CreateEnum
CREATE TYPE "CatalogVersionStatus" AS ENUM ('DRAFT', 'IN_VALIDATION', 'APPROVED', 'HISTORICAL');

-- CreateTable
CREATE TABLE "catalog_versions" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "CatalogVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "basedOnVersionId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_versions_programId_status_idx" ON "catalog_versions"("programId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_versions_programId_number_key" ON "catalog_versions"("programId", "number");

-- AddForeignKey
ALTER TABLE "catalog_versions" ADD CONSTRAINT "catalog_versions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_versions" ADD CONSTRAINT "catalog_versions_basedOnVersionId_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: el número de versión es positivo
ALTER TABLE "catalog_versions"
ADD CONSTRAINT "catalog_versions_number_check"
CHECK ("number" >= 1);

-- Una sola versión abierta (Borrador o En validación) por programa
CREATE UNIQUE INDEX "catalog_versions_one_open_per_program"
ON "catalog_versions"("programId")
WHERE "status" IN ('DRAFT', 'IN_VALIDATION');

-- Una sola versión Aprobada (vigente) por programa
CREATE UNIQUE INDEX "catalog_versions_one_approved_per_program"
ON "catalog_versions"("programId")
WHERE "status" = 'APPROVED';
