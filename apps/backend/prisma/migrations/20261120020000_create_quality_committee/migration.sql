-- CreateTable
CREATE TABLE "quality_committees" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_committees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quality_committees_programId_periodStart_idx" ON "quality_committees"("programId", "periodStart");

-- AddForeignKey
ALTER TABLE "quality_committees" ADD CONSTRAINT "quality_committees_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
