-- CreateTable
CREATE TABLE "educational_objectives" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educational_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "educational_objectives_versionId_idx" ON "educational_objectives"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "educational_objectives_versionId_code_key" ON "educational_objectives"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "educational_objectives_versionId_order_key" ON "educational_objectives"("versionId", "order");

-- AddForeignKey
ALTER TABLE "educational_objectives" ADD CONSTRAINT "educational_objectives_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: formato del código (p. ej. OEP1)
ALTER TABLE "educational_objectives"
ADD CONSTRAINT "educational_objectives_code_format_check"
CHECK ("code" ~ '^[A-Z][A-Z0-9-]{1,19}$');

-- Restricción: el enunciado no puede quedar vacío
ALTER TABLE "educational_objectives"
ADD CONSTRAINT "educational_objectives_statement_check"
CHECK (btrim("statement") <> '');

-- Restricción: el orden es positivo
ALTER TABLE "educational_objectives"
ADD CONSTRAINT "educational_objectives_order_check"
CHECK ("order" >= 1);
