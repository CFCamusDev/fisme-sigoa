-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('ANNEX', 'MINUTES', 'SURVEY', 'INSTRUMENT');

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_code_key" ON "templates"("code");

-- CreateIndex
CREATE INDEX "templates_type_idx" ON "templates"("type");

-- Restricción: el código de la plantilla no puede quedar vacío
ALTER TABLE "templates"
ADD CONSTRAINT "templates_code_check"
CHECK (length(btrim("code")) > 0);
