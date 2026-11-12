import { z } from 'zod';

export const SEMESTER_CODE_PATTERN = /^\d{4}-(I|II)$/;
export const SEMESTER_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidSemesterDate(dateString: string): boolean {
  if (!SEMESTER_DATE_PATTERN.test(dateString)) {
    return false;
  }

  const parts = dateString.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];
  if (!yearStr || !monthStr || !dayStr) {
    return false;
  }

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12) {
    return false;
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const maxDays = daysInMonth[month - 1];
  if (maxDays === undefined) {
    return false;
  }

  return day >= 1 && day <= maxDays;
}

export const semesterCodeSchema = z
  .string()
  .trim()
  .regex(
    SEMESTER_CODE_PATTERN,
    'El código del semestre debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2027-I)',
  );

export const semesterDateSchema = z
  .string()
  .trim()
  .regex(
    SEMESTER_DATE_PATTERN,
    'La fecha debe tener el formato AAAA-MM-DD (por ejemplo, 2027-03-01)',
  )
  .refine(isValidSemesterDate, 'La fecha debe ser una fecha de calendario real válida');

export const createSemesterRequestSchema = z
  .object({
    code: semesterCodeSchema,
    startDate: semesterDateSchema,
    endDate: semesterDateSchema,
  })
  .strict()
  .refine((data) => data.startDate < data.endDate, {
    message: 'La fecha de inicio debe ser anterior a la fecha de fin.',
    path: ['startDate'],
  });

export type CreateSemesterRequest = z.infer<typeof createSemesterRequestSchema>;

export const semesterDtoSchema = z
  .object({
    id: z.string().min(1, 'El identificador del semestre es obligatorio'),
    code: semesterCodeSchema,
    startDate: semesterDateSchema,
    endDate: semesterDateSchema,
    createdAt: z
      .string()
      .datetime({ message: 'La fecha de creación debe ser un timestamp ISO 8601' })
      .optional(),
    updatedAt: z.string().datetime({
      message: 'La fecha de actualización debe ser un timestamp ISO 8601',
    }),
  })
  .strict();

export type SemesterDto = z.infer<typeof semesterDtoSchema>;

export const listSemestersQuerySchema = z.object({}).strict();
export type ListSemestersQuery = z.infer<typeof listSemestersQuerySchema>;

export const listSemestersResponseSchema = z
  .object({
    items: z.array(semesterDtoSchema),
  })
  .strict();

export type ListSemestersResponse = z.infer<typeof listSemestersResponseSchema>;
