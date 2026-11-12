import { z } from 'zod';

export const PROGRAM_CODE_MIN_LENGTH = 2;
export const PROGRAM_CODE_MAX_LENGTH = 20;
export const PROGRAM_CODE_PATTERN = /^[A-Z0-9_-]+$/;

export const PROGRAM_NAME_MIN_LENGTH = 3;
export const PROGRAM_NAME_MAX_LENGTH = 150;

export const PROGRAM_FACULTY_MIN_LENGTH = 3;
export const PROGRAM_FACULTY_MAX_LENGTH = 150;

export const programCodeSchema = z
  .string()
  .trim()
  .min(
    PROGRAM_CODE_MIN_LENGTH,
    `El código del programa debe tener al menos ${PROGRAM_CODE_MIN_LENGTH} caracteres`,
  )
  .max(
    PROGRAM_CODE_MAX_LENGTH,
    `El código del programa no puede exceder ${PROGRAM_CODE_MAX_LENGTH} caracteres`,
  )
  .regex(
    PROGRAM_CODE_PATTERN,
    'El código del programa debe contener solo mayúsculas, números, guiones y guiones bajos',
  );

export const programNameSchema = z
  .string()
  .trim()
  .min(
    PROGRAM_NAME_MIN_LENGTH,
    `El nombre del programa debe tener al menos ${PROGRAM_NAME_MIN_LENGTH} caracteres`,
  )
  .max(
    PROGRAM_NAME_MAX_LENGTH,
    `El nombre del programa no puede exceder ${PROGRAM_NAME_MAX_LENGTH} caracteres`,
  );

export const programFacultySchema = z
  .string()
  .trim()
  .min(
    PROGRAM_FACULTY_MIN_LENGTH,
    `La facultad debe tener al menos ${PROGRAM_FACULTY_MIN_LENGTH} caracteres`,
  )
  .max(
    PROGRAM_FACULTY_MAX_LENGTH,
    `La facultad no puede exceder ${PROGRAM_FACULTY_MAX_LENGTH} caracteres`,
  );

export const programDtoSchema = z
  .object({
    id: z.string().min(1, 'El identificador del programa es obligatorio'),
    code: programCodeSchema,
    name: programNameSchema,
    faculty: programFacultySchema,
    updatedAt: z.string().datetime({
      message: 'La fecha de actualización debe ser un timestamp ISO 8601',
    }),
  })
  .strict();

export type ProgramDto = z.infer<typeof programDtoSchema>;

export const updateProgramRequestSchema = z
  .object({
    code: programCodeSchema.optional(),
    name: programNameSchema.optional(),
    faculty: programFacultySchema.optional(),
  })
  .strict()
  .refine(
    (data) => data.code !== undefined || data.name !== undefined || data.faculty !== undefined,
    {
      message: 'Debe proporcionar al menos un campo para actualizar.',
    },
  );

export type UpdateProgramRequest = z.infer<typeof updateProgramRequestSchema>;

export const getProgramQuerySchema = z.object({}).strict();
export type GetProgramQuery = z.infer<typeof getProgramQuerySchema>;
