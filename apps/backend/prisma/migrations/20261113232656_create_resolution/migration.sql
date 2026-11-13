-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('EDUCATIONAL_OBJECTIVE', 'GRADUATE_ATTRIBUTE', 'IMPROVEMENT_PLAN');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('REGISTERED', 'APPROVED');

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "type" "ResolutionType" NOT NULL,
    "number" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'REGISTERED',
    "catalogVersionId" TEXT,
    "pdfFileId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_pdfFileId_key" ON "resolutions"("pdfFileId");

-- CreateIndex
CREATE INDEX "resolutions_status_idx" ON "resolutions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_number_type_key" ON "resolutions"("number", "type");

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_catalogVersionId_type_key" ON "resolutions"("catalogVersionId", "type");

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: el número no puede quedar vacío
ALTER TABLE "resolutions"
ADD CONSTRAINT "resolutions_number_check"
CHECK (btrim("number") <> '');

-- Restricción: una resolución aprobada exige PDF, fecha y responsable de la aprobación (RN-063)
ALTER TABLE "resolutions"
ADD CONSTRAINT "resolutions_approved_requires_pdf_check"
CHECK (
  "status" <> 'APPROVED'
  OR ("pdfFileId" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedBy" IS NOT NULL)
);
