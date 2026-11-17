-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('P611', 'P612', 'P613', 'P621', 'P622', 'P623');

-- CreateEnum
CREATE TYPE "ProcessExecutionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CONSOLIDATING', 'PENDING_APPROVAL', 'CLOSED', 'VOIDED');

-- CreateTable
CREATE TABLE "process_executions" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "type" "ProcessType" NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semesterId" TEXT,
    "catalogVersionId" TEXT NOT NULL,
    "status" "ProcessExecutionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_executions_type_year_idx" ON "process_executions"("type", "year");

-- CreateIndex
CREATE INDEX "process_executions_status_idx" ON "process_executions"("status");

-- CreateIndex
CREATE INDEX "process_executions_catalogVersionId_idx" ON "process_executions"("catalogVersionId");

-- CreateIndex
CREATE INDEX "process_executions_semesterId_idx" ON "process_executions"("semesterId");

-- AddForeignKey
ALTER TABLE "process_executions" ADD CONSTRAINT "process_executions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_executions" ADD CONSTRAINT "process_executions_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_executions" ADD CONSTRAINT "process_executions_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: año válido de ejecución
ALTER TABLE "process_executions"
ADD CONSTRAINT "process_executions_year_check"
CHECK ("year" BETWEEN 2000 AND 2100);

-- Restricción: semesterId obligatorio si y solo si el tipo es P622
ALTER TABLE "process_executions"
ADD CONSTRAINT "process_executions_semester_for_p622_check"
CHECK (("type" = 'P622') = ("semesterId" IS NOT NULL));

-- Unicidad de nombre por programa (ignorando mayúsculas) mientras la ejecución no esté anulada
CREATE UNIQUE INDEX "process_executions_program_name_active_key"
ON "process_executions"("programId", lower("name"))
WHERE "status" <> 'VOIDED';
