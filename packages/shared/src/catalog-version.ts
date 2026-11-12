import { z } from 'zod';

export const CATALOG_VERSION_STATUSES = [
  'DRAFT',
  'IN_VALIDATION',
  'APPROVED',
  'HISTORICAL',
] as const;

/** Límites del texto del catálogo; el dominio los repite y una prueba compara ambos lados. */
export const CATALOG_CODE_PATTERN = /^[A-Z][A-Z0-9-]{1,19}$/;
export const CATALOG_STATEMENT_MAX_LENGTH = 2000;
export const CATALOG_NAME_MAX_LENGTH = 120;

export const catalogVersionStatusSchema = z.enum(CATALOG_VERSION_STATUSES, {
  message: 'El estado de la versión debe ser DRAFT, IN_VALIDATION, APPROVED o HISTORICAL',
});
export type CatalogVersionStatusValue = z.infer<typeof catalogVersionStatusSchema>;

/**
 * Crear una versión no lleva datos: el servidor resuelve el programa y copia la vigente (D19).
 * El cuerpo ausente equivale a `{}`; cualquier campo extra se rechaza.
 */
export const createCatalogVersionRequestSchema = z.preprocess(
  (value) => (value === undefined ? {} : value),
  z.object({}).strict(),
);
export type CreateCatalogVersionRequest = z.infer<typeof createCatalogVersionRequestSchema>;

/** El listado no admite parámetros: rechaza cualquier query. */
export const listCatalogVersionsQuerySchema = z.object({}).strict();
export type ListCatalogVersionsQuery = z.infer<typeof listCatalogVersionsQuerySchema>;

export const catalogVersionDtoSchema = z
  .object({
    id: z.string().min(1, 'El identificador de la versión es obligatorio'),
    programId: z.string().min(1, 'El identificador del programa es obligatorio'),
    number: z.number().int().min(1),
    status: catalogVersionStatusSchema,
    basedOnVersionId: z.string().min(1).nullable(),
    objectiveCount: z.number().int().min(0),
    attributeCount: z.number().int().min(0),
    createdAt: z.string().datetime({ message: 'La fecha de creación debe estar en formato ISO' }),
  })
  .strict();
export type CatalogVersionDto = z.infer<typeof catalogVersionDtoSchema>;

export const listCatalogVersionsResponseSchema = z
  .object({ items: z.array(catalogVersionDtoSchema) })
  .strict();
export type ListCatalogVersionsResponse = z.infer<typeof listCatalogVersionsResponseSchema>;
