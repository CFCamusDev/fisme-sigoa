-- CreateTable
CREATE TABLE "parameters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "effectiveFromSemesterId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parameters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parameters_key_idx" ON "parameters"("key");

-- CreateIndex
CREATE UNIQUE INDEX "parameters_key_effectiveFromSemesterId_key" ON "parameters"("key", "effectiveFromSemesterId");

-- AddForeignKey
ALTER TABLE "parameters" ADD CONSTRAINT "parameters_effectiveFromSemesterId_fkey" FOREIGN KEY ("effectiveFromSemesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice único parcial: un solo valor por defecto por clave (los NULL no chocan en un índice normal)
CREATE UNIQUE INDEX "parameters_key_default_key" ON "parameters"("key") WHERE "effectiveFromSemesterId" IS NULL;

-- Restricción: los valores son enteros no negativos (RF-011)
ALTER TABLE "parameters"
ADD CONSTRAINT "parameters_value_check"
CHECK ("value" >= 0);

-- Restricción: formato de la clave (SCREAMING_SNAKE_CASE)
ALTER TABLE "parameters"
ADD CONSTRAINT "parameters_key_format_check"
CHECK ("key" ~ '^[A-Z][A-Z0-9_]*$');
