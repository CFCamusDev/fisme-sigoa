-- CreateEnum
CREATE TYPE "ScaleType" AS ENUM ('LIKERT', 'NUMERIC', 'EVIDENCE');

-- CreateTable
CREATE TABLE "response_scales" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScaleType" NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_scales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "response_scales_code_key" ON "response_scales"("code");

-- Restricción: formato del código (SCREAMING_SNAKE_CASE, 2 a 40 caracteres)
ALTER TABLE "response_scales"
ADD CONSTRAINT "response_scales_code_format_check"
CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,39}$');

-- Restricción: el nombre no puede quedar vacío
ALTER TABLE "response_scales"
ADD CONSTRAINT "response_scales_name_check"
CHECK (btrim("name") <> '');
