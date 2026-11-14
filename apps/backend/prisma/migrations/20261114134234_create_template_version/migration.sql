-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OBSOLETE');

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_versions_templateId_status_idx" ON "template_versions"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_templateId_number_key" ON "template_versions"("templateId", "number");

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción: el número de versión es positivo
ALTER TABLE "template_versions"
ADD CONSTRAINT "template_versions_number_check"
CHECK ("number" >= 1);

-- Restricción: el contenido no puede quedar vacío
ALTER TABLE "template_versions"
ADD CONSTRAINT "template_versions_content_check"
CHECK (length(btrim("content")) > 0);

-- Restricción: solo un Borrador carece de fecha de publicación
ALTER TABLE "template_versions"
ADD CONSTRAINT "template_versions_published_at_check"
CHECK (
  ("status" = 'DRAFT' AND "publishedAt" IS NULL)
  OR ("status" <> 'DRAFT' AND "publishedAt" IS NOT NULL)
);

-- Un solo Borrador por plantilla
CREATE UNIQUE INDEX "template_versions_one_draft_per_template"
ON "template_versions"("templateId")
WHERE "status" = 'DRAFT';

-- Una sola versión Publicada por plantilla
CREATE UNIQUE INDEX "template_versions_one_published_per_template"
ON "template_versions"("templateId")
WHERE "status" = 'PUBLISHED';

-- Inmutabilidad de la evidencia (RN-007, RS-024): lo publicado no cambia y Obsoleta es terminal
CREATE FUNCTION "template_versions_guard_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."templateId" IS DISTINCT FROM OLD."templateId"
     OR NEW."number" IS DISTINCT FROM OLD."number" THEN
    RAISE EXCEPTION 'La plantilla y el número de una versión no pueden cambiar'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."status" = 'OBSOLETE' THEN
    RAISE EXCEPTION 'Una versión obsoleta no puede modificarse'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."status" = 'PUBLISHED' THEN
    IF NEW."status" <> 'OBSOLETE' THEN
      RAISE EXCEPTION 'Una versión publicada solo puede pasar a obsoleta'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."content" IS DISTINCT FROM OLD."content"
       OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
       OR NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy" THEN
      RAISE EXCEPTION 'El contenido de una versión publicada no puede modificarse'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD."status" = 'DRAFT' AND NEW."status" = 'OBSOLETE' THEN
    RAISE EXCEPTION 'Un borrador solo puede publicarse'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "template_versions_guard_update"
BEFORE UPDATE ON "template_versions"
FOR EACH ROW EXECUTE FUNCTION "template_versions_guard_update"();

-- Solo se borran Borradores (RS-070, RS-071)
CREATE FUNCTION "template_versions_guard_delete"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo pueden borrarse versiones en borrador'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "template_versions_guard_delete"
BEFORE DELETE ON "template_versions"
FOR EACH ROW EXECUTE FUNCTION "template_versions_guard_delete"();
