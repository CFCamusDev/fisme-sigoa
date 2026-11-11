import { z } from 'zod';

export const SCALE_TYPES = ['LIKERT', 'NUMERIC', 'EVIDENCE'] as const;

export const SCALE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
export const SCALE_NAME_MAX_LENGTH = 120;
export const SCALE_LABEL_MAX_LENGTH = 120;
export const SCALE_MIN_LEVELS = 2;
export const SCALE_MAX_LEVELS = 10;
export const SCALE_MIN_VALUE = 0;
export const SCALE_MAX_VALUE = 100;
export const SCALE_ID_MAX_LENGTH = 64;

export const scaleTypeSchema = z.enum(SCALE_TYPES, {
  message: 'El tipo de escala debe ser LIKERT, NUMERIC o EVIDENCE',
});
export type ScaleTypeValue = z.infer<typeof scaleTypeSchema>;

export const scaleCodeSchema = z
  .string()
  .trim()
  .regex(
    SCALE_CODE_PATTERN,
    'El código debe tener de 2 a 40 caracteres: mayúsculas, números y guion bajo, empezando por una letra',
  );

export const scaleNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la escala es obligatorio')
  .max(SCALE_NAME_MAX_LENGTH, `El nombre no puede superar ${SCALE_NAME_MAX_LENGTH} caracteres`);

const scaleLevelLabelSchema = z
  .string()
  .trim()
  .min(1, 'La etiqueta del nivel es obligatoria')
  .max(
    SCALE_LABEL_MAX_LENGTH,
    `La etiqueta del nivel no puede superar ${SCALE_LABEL_MAX_LENGTH} caracteres`,
  );

const scaleLevelValueSchema = z
  .number({ message: 'El valor del nivel debe ser un número' })
  .int('El valor del nivel debe ser un entero')
  .min(SCALE_MIN_VALUE, `El valor del nivel debe ser como mínimo ${SCALE_MIN_VALUE}`)
  .max(SCALE_MAX_VALUE, `El valor del nivel debe ser como máximo ${SCALE_MAX_VALUE}`);

export const scaleLevelInputSchema = z
  .object({
    label: scaleLevelLabelSchema,
    value: scaleLevelValueSchema,
    countsAsAchievement: z.boolean({ message: 'Indica si el nivel cuenta como logro' }),
  })
  .strict();
export type ScaleLevelInput = z.infer<typeof scaleLevelInputSchema>;

const scaleLevelsInputSchema = z
  .array(scaleLevelInputSchema)
  .min(SCALE_MIN_LEVELS, `La escala debe tener al menos ${SCALE_MIN_LEVELS} niveles`)
  .max(SCALE_MAX_LEVELS, `La escala no puede tener más de ${SCALE_MAX_LEVELS} niveles`)
  .superRefine((levels, ctx) => {
    const values = new Set<number>();
    const labels = new Set<string>();
    levels.forEach((level, index) => {
      if (values.has(level.value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Los valores de los niveles no se pueden repetir',
          path: [index, 'value'],
        });
      }
      const labelKey = level.label.toLowerCase();
      if (labels.has(labelKey)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Las etiquetas de los niveles no se pueden repetir',
          path: [index, 'label'],
        });
      }
      values.add(level.value);
      labels.add(labelKey);
    });
  });

export const createResponseScaleRequestSchema = z
  .object({
    code: scaleCodeSchema,
    name: scaleNameSchema,
    type: scaleTypeSchema,
    levels: scaleLevelsInputSchema,
  })
  .strict();
export type CreateResponseScaleRequest = z.infer<typeof createResponseScaleRequestSchema>;

/** El código y el tipo no se envían: no cambian al editar. */
export const updateResponseScaleRequestSchema = z
  .object({
    name: scaleNameSchema.optional(),
    levels: scaleLevelsInputSchema.optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.levels !== undefined, {
    message: 'Indica el nombre o los niveles que quieres cambiar',
  });
export type UpdateResponseScaleRequest = z.infer<typeof updateResponseScaleRequestSchema>;

export const duplicateResponseScaleRequestSchema = z
  .object({
    code: scaleCodeSchema,
    name: scaleNameSchema,
  })
  .strict();
export type DuplicateResponseScaleRequest = z.infer<typeof duplicateResponseScaleRequestSchema>;

export const listResponseScalesQuerySchema = z
  .object({ type: scaleTypeSchema.optional() })
  .strict();
export type ListResponseScalesQuery = z.infer<typeof listResponseScalesQuerySchema>;

export const responseScaleIdParamSchema = z
  .object({
    id: z
      .string()
      .min(1, 'El identificador de la escala es obligatorio')
      .max(SCALE_ID_MAX_LENGTH, 'El identificador de la escala no es válido'),
  })
  .strict();
export type ResponseScaleIdParam = z.infer<typeof responseScaleIdParamSchema>;

export const scaleLevelDtoSchema = z
  .object({
    order: z.number().int().min(1),
    label: z.string().min(1),
    value: z.number().int(),
    countsAsAchievement: z.boolean(),
  })
  .strict();
export type ScaleLevelDto = z.infer<typeof scaleLevelDtoSchema>;

export const responseScaleDtoSchema = z
  .object({
    id: z.string().min(1, 'El identificador de la escala es obligatorio'),
    code: scaleCodeSchema,
    name: z.string().min(1),
    type: scaleTypeSchema,
    inUse: z.boolean(),
    levels: z.array(scaleLevelDtoSchema),
  })
  .strict();
export type ResponseScaleDto = z.infer<typeof responseScaleDtoSchema>;

export const responseScalesResponseSchema = z
  .object({ items: z.array(responseScaleDtoSchema) })
  .strict();
export type ResponseScalesResponse = z.infer<typeof responseScalesResponseSchema>;
