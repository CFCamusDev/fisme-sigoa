import { z } from 'zod';
import {
  CATALOG_CODE_PATTERN,
  CATALOG_NAME_MAX_LENGTH,
  CATALOG_STATEMENT_MAX_LENGTH,
  catalogVersionDtoSchema,
} from './catalog-version.js';

/** Máximo de OE y de AG por versión (D7); el dominio lo repite y una prueba compara ambos lados. */
export const CATALOG_MAX_ITEMS = 100;

const catalogItemIdSchema = z
  .string({ message: 'El identificador es obligatorio' })
  .min(1, 'El identificador es obligatorio')
  .max(64, 'El identificador no puede superar 64 caracteres');

const catalogCodeSchema = z
  .string({ message: 'El código es obligatorio' })
  .trim()
  .regex(
    CATALOG_CODE_PATTERN,
    'El código debe tener de 2 a 20 caracteres: mayúsculas, números y guion, empezando por una letra.',
  );

const catalogStatementSchema = z
  .string({ message: 'El enunciado es obligatorio' })
  .trim()
  .min(1, 'El enunciado es obligatorio')
  .max(
    CATALOG_STATEMENT_MAX_LENGTH,
    `El enunciado no puede superar ${CATALOG_STATEMENT_MAX_LENGTH} caracteres`,
  );

const catalogNameSchema = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(CATALOG_NAME_MAX_LENGTH, `El nombre no puede superar ${CATALOG_NAME_MAX_LENGTH} caracteres`);

/** Parámetro de ruta `:id` de las operaciones sobre una versión. */
export const catalogVersionIdParamsSchema = z
  .object({
    id: z
      .string({ message: 'El identificador de la versión es obligatorio' })
      .min(1, 'El identificador de la versión es obligatorio')
      .max(64, 'El identificador de la versión no puede superar 64 caracteres'),
  })
  .strict();
export type CatalogVersionIdParams = z.infer<typeof catalogVersionIdParamsSchema>;

/** Las operaciones de edición no admiten parámetros de consulta. */
export const catalogItemsQuerySchema = z.object({}).strict();

const isoDateSchema = z.string().datetime({ message: 'La fecha debe estar en formato ISO' });

export const catalogObjectiveDtoSchema = z
  .object({
    id: catalogItemIdSchema,
    code: z.string().min(1),
    statement: z.string().min(1),
    order: z.number().int().min(1),
    updatedAt: isoDateSchema,
  })
  .strict();
export type CatalogObjectiveDto = z.infer<typeof catalogObjectiveDtoSchema>;

export const catalogAttributeDtoSchema = z
  .object({
    id: catalogItemIdSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    statement: z.string().min(1),
    order: z.number().int().min(1),
    updatedAt: isoDateSchema,
  })
  .strict();
export type CatalogAttributeDto = z.infer<typeof catalogAttributeDtoSchema>;

export const catalogVersionDetailDtoSchema = z
  .object({
    version: catalogVersionDtoSchema,
    objectives: z.array(catalogObjectiveDtoSchema),
    attributes: z.array(catalogAttributeDtoSchema),
  })
  .strict();
export type CatalogVersionDetailDto = z.infer<typeof catalogVersionDetailDtoSchema>;

/** Alta (sin `id`) o edición (con `id`) de un OE. */
export const saveCatalogObjectiveRequestSchema = z
  .object({
    operation: z.literal('SAVE'),
    id: catalogItemIdSchema.optional(),
    code: catalogCodeSchema,
    statement: catalogStatementSchema,
  })
  .strict();
export type SaveCatalogObjectiveRequest = z.infer<typeof saveCatalogObjectiveRequestSchema>;

/** Alta (sin `id`) o edición (con `id`) de un AG. */
export const saveCatalogAttributeRequestSchema = z
  .object({
    operation: z.literal('SAVE'),
    id: catalogItemIdSchema.optional(),
    code: catalogCodeSchema,
    name: catalogNameSchema,
    statement: catalogStatementSchema,
  })
  .strict();
export type SaveCatalogAttributeRequest = z.infer<typeof saveCatalogAttributeRequestSchema>;

/** Lista completa de ids en el orden nuevo; sin repetidos y acotada. */
export const reorderCatalogItemsRequestSchema = z
  .object({
    operation: z.literal('REORDER'),
    orderedIds: z
      .array(catalogItemIdSchema, { message: 'La lista de elementos es obligatoria' })
      .min(1, 'La lista de elementos no puede estar vacía')
      .max(CATALOG_MAX_ITEMS, `La lista no puede superar ${CATALOG_MAX_ITEMS} elementos`)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'La lista no puede tener elementos repetidos',
      ),
  })
  .strict();
export type ReorderCatalogItemsRequest = z.infer<typeof reorderCatalogItemsRequestSchema>;

export const catalogObjectivesRequestSchema = z.discriminatedUnion(
  'operation',
  [saveCatalogObjectiveRequestSchema, reorderCatalogItemsRequestSchema],
  { message: 'La operación debe ser SAVE o REORDER' },
);
export type CatalogObjectivesRequest = z.infer<typeof catalogObjectivesRequestSchema>;

export const catalogAttributesRequestSchema = z.discriminatedUnion(
  'operation',
  [saveCatalogAttributeRequestSchema, reorderCatalogItemsRequestSchema],
  { message: 'La operación debe ser SAVE o REORDER' },
);
export type CatalogAttributesRequest = z.infer<typeof catalogAttributesRequestSchema>;

export const catalogObjectivesResponseSchema = z
  .object({ items: z.array(catalogObjectiveDtoSchema) })
  .strict();
export type CatalogObjectivesResponse = z.infer<typeof catalogObjectivesResponseSchema>;

export const catalogAttributesResponseSchema = z
  .object({ items: z.array(catalogAttributeDtoSchema) })
  .strict();
export type CatalogAttributesResponse = z.infer<typeof catalogAttributesResponseSchema>;
