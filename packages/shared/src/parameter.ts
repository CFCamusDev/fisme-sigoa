import { z } from 'zod';
import { semesterCodeSchema } from './semester.js';

export const PARAMETER_KEYS = [
  'UMBRAL_LOGRADO',
  'META_AG',
  'PESO_DIRECTA',
  'PESO_INDIRECTA',
  'MIN_PARTICIPACION',
  'TOKEN_DIAS',
  'LOGIN_INTENTOS',
] as const;

export type ParameterKey = (typeof PARAMETER_KEYS)[number];

export const PARAMETER_UNITS = ['SCORE', 'PERCENT', 'COUNT', 'DAYS'] as const;
export type ParameterUnit = (typeof PARAMETER_UNITS)[number];

export interface ParameterDefinition {
  readonly key: ParameterKey;
  readonly label: string;
  readonly unit: ParameterUnit;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
}

export const PARAMETER_DEFINITIONS: Readonly<Record<ParameterKey, ParameterDefinition>> = {
  UMBRAL_LOGRADO: {
    key: 'UMBRAL_LOGRADO',
    label: 'Umbral de logrado',
    unit: 'SCORE',
    min: 0,
    max: 20,
    defaultValue: 14,
  },
  META_AG: {
    key: 'META_AG',
    label: 'Meta por atributo del graduado',
    unit: 'PERCENT',
    min: 0,
    max: 100,
    defaultValue: 70,
  },
  PESO_DIRECTA: {
    key: 'PESO_DIRECTA',
    label: 'Peso de la medición directa',
    unit: 'PERCENT',
    min: 0,
    max: 100,
    defaultValue: 70,
  },
  PESO_INDIRECTA: {
    key: 'PESO_INDIRECTA',
    label: 'Peso de la medición indirecta',
    unit: 'PERCENT',
    min: 0,
    max: 100,
    defaultValue: 30,
  },
  MIN_PARTICIPACION: {
    key: 'MIN_PARTICIPACION',
    label: 'Participación mínima',
    unit: 'COUNT',
    min: 1,
    max: 1000,
    defaultValue: 3,
  },
  TOKEN_DIAS: {
    key: 'TOKEN_DIAS',
    label: 'Días de vigencia del token',
    unit: 'DAYS',
    min: 1,
    max: 365,
    defaultValue: 7,
  },
  LOGIN_INTENTOS: {
    key: 'LOGIN_INTENTOS',
    label: 'Intentos de inicio de sesión',
    unit: 'COUNT',
    min: 1,
    max: 20,
    defaultValue: 5,
  },
};

export const PARAMETER_WEIGHTS_TOTAL = 100;

export const parameterKeySchema = z.enum(PARAMETER_KEYS, {
  message: 'La clave del parámetro no pertenece al catálogo.',
});

const parameterValueInputSchema = z
  .object({
    key: parameterKeySchema,
    value: z
      .number({ message: 'El valor debe ser un número entero.' })
      .int('El valor debe ser un número entero.'),
  })
  .strict();

export const defineParametersRequestSchema = z
  .object({
    semesterCode: semesterCodeSchema,
    values: z
      .array(parameterValueInputSchema)
      .min(1, 'Debe indicar al menos un parámetro.')
      .max(PARAMETER_KEYS.length, 'Se indicaron más parámetros de los existentes.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Map<ParameterKey, number>();
    data.values.forEach((item, index) => {
      if (seen.has(item.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['values', index, 'key'],
          message: `La clave ${item.key} está repetida.`,
        });
        return;
      }
      seen.set(item.key, item.value);
      const definition = PARAMETER_DEFINITIONS[item.key];
      if (item.value < definition.min || item.value > definition.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['values', index, 'value'],
          message: `El valor de ${item.key} debe ser un número entero entre ${definition.min} y ${definition.max}.`,
        });
      }
    });

    const direct = seen.get('PESO_DIRECTA');
    const indirect = seen.get('PESO_INDIRECTA');
    if (direct === undefined && indirect === undefined) {
      return;
    }
    if (direct === undefined || indirect === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['values'],
        message: 'Los pesos de medición directa e indirecta se definen juntos y deben sumar 100.',
      });
      return;
    }
    if (direct + indirect !== PARAMETER_WEIGHTS_TOTAL) {
      ctx.addIssue({
        code: 'custom',
        path: ['values'],
        message: `Los pesos de medición directa e indirecta deben sumar ${PARAMETER_WEIGHTS_TOTAL}.`,
      });
    }
  });

export type DefineParametersRequest = z.infer<typeof defineParametersRequestSchema>;

export const listParametersQuerySchema = z
  .object({
    semesterCode: semesterCodeSchema.optional(),
  })
  .strict();

export type ListParametersQuery = z.infer<typeof listParametersQuerySchema>;

export const parameterVersionDtoSchema = z
  .object({
    value: z.number().int(),
    effectiveFromSemesterCode: semesterCodeSchema.nullable(),
    effectiveToSemesterCode: semesterCodeSchema.nullable(),
  })
  .strict();

export type ParameterVersionDto = z.infer<typeof parameterVersionDtoSchema>;

export const parameterDtoSchema = z
  .object({
    key: parameterKeySchema,
    label: z.string().min(1),
    unit: z.enum(PARAMETER_UNITS),
    value: z.number().int(),
    effectiveFromSemesterCode: semesterCodeSchema.nullable(),
    versions: z.array(parameterVersionDtoSchema),
  })
  .strict();

export type ParameterDto = z.infer<typeof parameterDtoSchema>;

export const parametersResponseSchema = z
  .object({
    semesterCode: semesterCodeSchema.nullable(),
    items: z.array(parameterDtoSchema),
  })
  .strict();

export type ParametersResponse = z.infer<typeof parametersResponseSchema>;
