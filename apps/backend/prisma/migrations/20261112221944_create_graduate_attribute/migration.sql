-- CreateTable
CREATE TABLE "graduate_attributes" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graduate_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "graduate_attributes_versionId_idx" ON "graduate_attributes"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "graduate_attributes_versionId_code_key" ON "graduate_attributes"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "graduate_attributes_versionId_order_key" ON "graduate_attributes"("versionId", "order");

-- AddForeignKey
ALTER TABLE "graduate_attributes" ADD CONSTRAINT "graduate_attributes_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "catalog_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: formato del código (p. ej. AG-C01)
ALTER TABLE "graduate_attributes"
ADD CONSTRAINT "graduate_attributes_code_format_check"
CHECK ("code" ~ '^[A-Z][A-Z0-9-]{1,19}$');

-- Restricción: el nombre no puede quedar vacío
ALTER TABLE "graduate_attributes"
ADD CONSTRAINT "graduate_attributes_name_check"
CHECK (btrim("name") <> '');

-- Restricción: el enunciado no puede quedar vacío
ALTER TABLE "graduate_attributes"
ADD CONSTRAINT "graduate_attributes_statement_check"
CHECK (btrim("statement") <> '');

-- Restricción: el orden es positivo
ALTER TABLE "graduate_attributes"
ADD CONSTRAINT "graduate_attributes_order_check"
CHECK ("order" >= 1);
