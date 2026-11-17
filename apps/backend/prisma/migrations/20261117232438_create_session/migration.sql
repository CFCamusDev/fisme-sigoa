-- CreateEnum
CREATE TYPE "SessionModality" AS ENUM ('VIRTUAL', 'IN_PERSON', 'HYBRID');

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "stakeholderType" "StakeholderListType" NOT NULL,
    "stakeholderListId" TEXT,
    "sessionDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "modality" "SessionModality" NOT NULL,
    "meetingUrl" TEXT,
    "recordingUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_stakeholderListId_idx" ON "sessions"("stakeholderListId");

-- CreateIndex
CREATE INDEX "sessions_sessionDate_idx" ON "sessions"("sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_stakeholderType_sessionDate_startTime_key" ON "sessions"("stakeholderType", "sessionDate", "startTime");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_stakeholderListId_fkey" FOREIGN KEY ("stakeholderListId") REFERENCES "stakeholder_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: formato de hora HH:mm válido (00:00 a 23:59)
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_start_time_format_check"
CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Restricción: sesión virtual requiere enlace de reunión y enlace de grabación (CA3)
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_virtual_links_check"
CHECK ("modality" <> 'VIRTUAL' OR ("meetingUrl" IS NOT NULL AND "recordingUrl" IS NOT NULL));

-- Restricción: longitud máxima de enlaces (500 caracteres)
ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_meeting_url_length_check"
CHECK ("meetingUrl" IS NULL OR char_length("meetingUrl") <= 500);

ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_recording_url_length_check"
CHECK ("recordingUrl" IS NULL OR char_length("recordingUrl") <= 500);
