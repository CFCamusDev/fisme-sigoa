import { z } from 'zod';
import { catalogVersionDtoSchema } from './catalog-version.js';
import {
  RESOLUTION_NUMBER_MAX_LENGTH,
  resolutionStatusSchema,
  resolutionTypeSchema,
} from './resolutions.js';

export const CATALOG_ITEM_CHANGES = ['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED'] as const;
export const WORD_DIFF_SEGMENT_TYPES = ['EQUAL', 'ADDED', 'REMOVED'] as const;

const versionIdParamSchema = (label: string) =>
  z
    .string({ message: `El identificador de la versión ${label} es obligatorio` })
    .min(1, `El identificador de la versión ${label} es obligatorio`)
    .max(64, `El identificador de la versión ${label} no puede superar 64 caracteres`);

/** Parámetros de ruta de la comparación: versión base y versión destino. */
export const catalogComparisonParamsSchema = z
  .object({
    baseId: versionIdParamSchema('base'),
    targetId: versionIdParamSchema('destino'),
  })
  .strict();
export type CatalogComparisonParams = z.infer<typeof catalogComparisonParamsSchema>;

/** La comparación no admite parámetros de consulta: rechaza cualquier query. */
export const catalogComparisonQuerySchema = z.object({}).strict();
export type CatalogComparisonQuery = z.infer<typeof catalogComparisonQuerySchema>;

const isoDateTimeSchema = z.string().datetime({ message: 'La fecha debe estar en formato ISO' });

/** Resolución de una versión; sin datos de quién la registró o aprobó. */
export const catalogVersionResolutionDtoSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: resolutionTypeSchema,
    number: z.string().min(1).max(RESOLUTION_NUMBER_MAX_LENGTH),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),
    status: resolutionStatusSchema,
    approvedAt: isoDateTimeSchema.nullable(),
    hasPdf: z.boolean(),
  })
  .strict();
export type CatalogVersionResolutionDto = z.infer<typeof catalogVersionResolutionDtoSchema>;

/** Resolución y vigencia derivadas de una versión (HU-017, RF-017, RN-021). */
export const catalogVersionHistoryDtoSchema = z
  .object({
    validFrom: isoDateTimeSchema.nullable(),
    validUntil: isoDateTimeSchema.nullable(),
    resolutions: z.array(catalogVersionResolutionDtoSchema).max(10),
  })
  .strict();
export type CatalogVersionHistoryDto = z.infer<typeof catalogVersionHistoryDtoSchema>;

export const wordDiffSegmentDtoSchema = z
  .object({
    type: z.enum(WORD_DIFF_SEGMENT_TYPES),
    text: z.string().min(1),
  })
  .strict();
export type WordDiffSegmentDto = z.infer<typeof wordDiffSegmentDtoSchema>;

const itemSideDtoSchema = z
  .object({
    name: z.string().optional(),
    statement: z.string(),
  })
  .strict();

export const catalogItemDiffDtoSchema = z
  .object({
    code: z.string().min(1),
    change: z.enum(CATALOG_ITEM_CHANGES),
    base: itemSideDtoSchema.nullable(),
    target: itemSideDtoSchema.nullable(),
    nameSegments: z.array(wordDiffSegmentDtoSchema),
    statementSegments: z.array(wordDiffSegmentDtoSchema),
  })
  .strict();
export type CatalogItemDiffDto = z.infer<typeof catalogItemDiffDtoSchema>;

const comparedVersionDtoSchema = z
  .object({
    version: catalogVersionDtoSchema,
    history: catalogVersionHistoryDtoSchema,
  })
  .strict();

export const catalogComparisonDtoSchema = z
  .object({
    base: comparedVersionDtoSchema,
    target: comparedVersionDtoSchema,
    summary: z
      .object({
        added: z.number().int().min(0),
        removed: z.number().int().min(0),
        modified: z.number().int().min(0),
        unchanged: z.number().int().min(0),
      })
      .strict(),
    objectives: z.array(catalogItemDiffDtoSchema),
    attributes: z.array(catalogItemDiffDtoSchema),
  })
  .strict();
export type CatalogComparisonDto = z.infer<typeof catalogComparisonDtoSchema>;
