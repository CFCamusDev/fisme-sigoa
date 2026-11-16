-- CreateEnum
CREATE TYPE "StakeholderListType" AS ENUM ('ADVISORY_BOARD', 'EMPLOYER', 'GRADUATE', 'STUDENT', 'TEACHER');

-- CreateTable
CREATE TABLE "stakeholder_lists" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "type" "StakeholderListType" NOT NULL,
    "year" INTEGER NOT NULL,
    "studyPlanNumber" TEXT,
    "version" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholder_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stakeholder_lists_type_year_idx" ON "stakeholder_lists"("type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "stakeholder_lists_programId_type_year_key" ON "stakeholder_lists"("programId", "type", "year");

-- AddForeignKey
ALTER TABLE "stakeholder_lists" ADD CONSTRAINT "stakeholder_lists_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
