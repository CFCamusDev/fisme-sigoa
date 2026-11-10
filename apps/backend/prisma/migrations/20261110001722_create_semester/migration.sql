-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

-- CreateIndex
CREATE INDEX "semesters_startDate_idx" ON "semesters"("startDate");

-- AlterTable: Restricción de orden cronológico (startDate < endDate)
ALTER TABLE "semesters"
ADD CONSTRAINT "semesters_dates_check"
CHECK ("startDate" < "endDate");

-- AlterTable: Restricción de no superposición de rangos cerrados (RF-010)
ALTER TABLE "semesters"
ADD CONSTRAINT "semesters_no_overlap"
EXCLUDE USING gist (daterange("startDate", "endDate", '[]') WITH &&);

