-- CreateTable
CREATE TABLE "scale_levels" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "countsAsAchievement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scale_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scale_levels_scaleId_idx" ON "scale_levels"("scaleId");

-- CreateIndex
CREATE UNIQUE INDEX "scale_levels_scaleId_order_key" ON "scale_levels"("scaleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "scale_levels_scaleId_value_key" ON "scale_levels"("scaleId", "value");

-- AddForeignKey
ALTER TABLE "scale_levels" ADD CONSTRAINT "scale_levels_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "response_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: el orden empieza en 1
ALTER TABLE "scale_levels"
ADD CONSTRAINT "scale_levels_order_check"
CHECK ("order" >= 1);

-- Restricción: el valor del nivel está entre 0 y 100
ALTER TABLE "scale_levels"
ADD CONSTRAINT "scale_levels_value_check"
CHECK ("value" BETWEEN 0 AND 100);

-- Restricción: la etiqueta no puede quedar vacía
ALTER TABLE "scale_levels"
ADD CONSTRAINT "scale_levels_label_check"
CHECK (btrim("label") <> '');
