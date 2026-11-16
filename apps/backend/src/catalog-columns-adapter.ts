import type {
  CatalogProgramReader,
  CatalogVersionReader,
  EducationalObjectiveReader,
  GraduateAttributeReader,
} from './modules/catalog/index.js';
import type { CatalogColumnsReader } from './modules/templates/index.js';

export interface CatalogColumnsAdapterDependencies {
  readonly programReader: CatalogProgramReader;
  readonly versionReader: CatalogVersionReader;
  readonly objectiveReader: EducationalObjectiveReader;
  readonly attributeReader: GraduateAttributeReader;
}

/** Adaptador de composición que lee las columnas OE y AG del catálogo vigente. */
export function createCatalogColumnsReader(
  deps: CatalogColumnsAdapterDependencies,
): CatalogColumnsReader {
  return {
    async readCurrent() {
      const programId = await deps.programReader.getCurrentProgramId();
      if (!programId) {
        return null;
      }

      const currentVersion = await deps.versionReader.findCurrent(programId);
      if (!currentVersion) {
        return null;
      }

      const [objectives, attributes] = await Promise.all([
        deps.objectiveReader.listByVersion(currentVersion.id),
        deps.attributeReader.listByVersion(currentVersion.id),
      ]);

      return {
        catalogVersionId: currentVersion.id,
        catalogVersionNumber: currentVersion.number,
        objectives: [...objectives]
          .sort((left, right) => left.order - right.order)
          .map((objective) => ({
            code: objective.code,
            statement: objective.statement,
            order: objective.order,
          })),
        attributes: [...attributes]
          .sort((left, right) => left.order - right.order)
          .map((attribute) => ({
            code: attribute.code,
            name: attribute.name,
            statement: attribute.statement,
            order: attribute.order,
          })),
      };
    },
  };
}
