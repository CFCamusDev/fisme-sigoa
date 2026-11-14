import { z } from 'zod';

export const TEMPLATE_TYPES = ['ANNEX', 'MINUTES', 'SURVEY', 'INSTRUMENT'] as const;
export const TEMPLATE_VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'OBSOLETE'] as const;

/** Máximo del HTML de una versión; el dominio importa este mismo valor. */
export const TEMPLATE_CONTENT_MAX_LENGTH = 40_000;
export const TEMPLATE_ID_MAX_LENGTH = 64;
export const TEMPLATE_VARIABLE_KEY_MAX_LENGTH = 60;
export const TEMPLATE_VARIABLE_LABEL_MAX_LENGTH = 80;
export const TEMPLATE_VARIABLES_MAX = 100;
export const TEMPLATE_VARIABLE_KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;
export const TEMPLATES_PAGE_MAX = 10_000;
export const TEMPLATES_PAGE_SIZE_MAX = 100;
export const TEMPLATES_PAGE_SIZE_DEFAULT = 50;

export const templateTypeSchema = z.enum(TEMPLATE_TYPES, {
  message: 'El tipo debe ser ANNEX, MINUTES, SURVEY o INSTRUMENT',
});
export type TemplateTypeValue = z.infer<typeof templateTypeSchema>;

export const templateVersionStatusSchema = z.enum(TEMPLATE_VERSION_STATUSES, {
  message: 'El estado debe ser DRAFT, PUBLISHED u OBSOLETE',
});
export type TemplateVersionStatusValue = z.infer<typeof templateVersionStatusSchema>;

const templateIdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador es obligatorio')
  .max(
    TEMPLATE_ID_MAX_LENGTH,
    `El identificador no puede exceder ${TEMPLATE_ID_MAX_LENGTH} caracteres`,
  );

/** Variable permitida en el HTML de una plantilla, usada como `{{key}}`. */
export const templateVariableSchema = z
  .object({
    key: z
      .string()
      .min(1, 'La clave de la variable es obligatoria')
      .max(
        TEMPLATE_VARIABLE_KEY_MAX_LENGTH,
        `La clave no puede exceder ${TEMPLATE_VARIABLE_KEY_MAX_LENGTH} caracteres`,
      )
      .regex(
        TEMPLATE_VARIABLE_KEY_PATTERN,
        'La clave debe empezar con minúscula y usar solo letras, dígitos y puntos entre segmentos',
      ),
    label: z
      .string()
      .min(1, 'La etiqueta de la variable es obligatoria')
      .max(
        TEMPLATE_VARIABLE_LABEL_MAX_LENGTH,
        `La etiqueta no puede exceder ${TEMPLATE_VARIABLE_LABEL_MAX_LENGTH} caracteres`,
      ),
  })
  .strict();
export type TemplateVariableDto = z.infer<typeof templateVariableSchema>;

export const templateVariablesSchema = z
  .array(templateVariableSchema)
  .max(TEMPLATE_VARIABLES_MAX, `Una plantilla admite hasta ${TEMPLATE_VARIABLES_MAX} variables`)
  .refine(
    (variables) => new Set(variables.map((variable) => variable.key)).size === variables.length,
    'Las claves de las variables no pueden repetirse',
  );

const templateContentSchema = z
  .string()
  .max(
    TEMPLATE_CONTENT_MAX_LENGTH,
    `El contenido no puede exceder ${TEMPLATE_CONTENT_MAX_LENGTH} caracteres`,
  )
  .refine((value) => value.trim().length > 0, 'El contenido es obligatorio');

export const templateIdParamsSchema = z.object({ id: templateIdSchema }).strict();
export type TemplateIdParams = z.infer<typeof templateIdParamsSchema>;

export const listTemplatesQuerySchema = z
  .object({
    type: templateTypeSchema.optional(),
    page: z.coerce
      .number()
      .int()
      .min(1, 'La página debe ser mayor o igual a 1')
      .max(TEMPLATES_PAGE_MAX, `La página no puede exceder ${TEMPLATES_PAGE_MAX}`)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'El tamaño de página debe ser al menos 1')
      .max(
        TEMPLATES_PAGE_SIZE_MAX,
        `El tamaño de página no puede exceder ${TEMPLATES_PAGE_SIZE_MAX}`,
      )
      .default(TEMPLATES_PAGE_SIZE_DEFAULT),
  })
  .strict();
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

/** Guardar el borrador (HU-018): el HTML completo de la versión en edición. */
export const saveTemplateDraftRequestSchema = z.object({ content: templateContentSchema }).strict();
export type SaveTemplateDraftRequest = z.infer<typeof saveTemplateDraftRequestSchema>;

/**
 * Publicar lleva el borrador que el administrador vio (D7) y la fecha de su última actualización:
 * si el contenido cambió desde entonces, el servidor responde 409.
 */
export const publishTemplateRequestSchema = z
  .object({
    versionId: templateIdSchema,
    expectedUpdatedAt: z.string().datetime({ message: 'La fecha esperada debe ser una fecha ISO' }),
  })
  .strict();
export type PublishTemplateRequest = z.infer<typeof publishTemplateRequestSchema>;

/** `publishedAt` es nulo mientras la versión es Borrador, como en la base de datos. */
export const templateVersionSummaryDtoSchema = z
  .object({
    id: z.string().min(1),
    number: z.number().int().min(1),
    status: templateVersionStatusSchema,
    publishedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type TemplateVersionSummaryDto = z.infer<typeof templateVersionSummaryDtoSchema>;

export const templateVersionDtoSchema = templateVersionSummaryDtoSchema
  .extend({ content: z.string().min(1) })
  .strict();
export type TemplateVersionDto = z.infer<typeof templateVersionDtoSchema>;

const templateBaseShape = {
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: templateTypeSchema,
  variables: templateVariablesSchema,
};

/** `published` es nulo si la plantilla aún no tiene versión publicada; `draft`, si no hay borrador. */
export const templateSummaryDtoSchema = z
  .object({
    ...templateBaseShape,
    published: templateVersionSummaryDtoSchema.nullable(),
    draft: templateVersionSummaryDtoSchema.nullable(),
  })
  .strict();
export type TemplateSummaryDto = z.infer<typeof templateSummaryDtoSchema>;

/** Detalle para el editor: historial (número descendente) y contenido de la publicada y el borrador. */
export const templateDetailDtoSchema = z
  .object({
    ...templateBaseShape,
    versions: z.array(templateVersionSummaryDtoSchema),
    published: templateVersionDtoSchema.nullable(),
    draft: templateVersionDtoSchema.nullable(),
  })
  .strict();
export type TemplateDetailDto = z.infer<typeof templateDetailDtoSchema>;

export const listTemplatesResponseSchema = z
  .object({
    items: z.array(templateSummaryDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();
export type ListTemplatesResponse = z.infer<typeof listTemplatesResponseSchema>;
