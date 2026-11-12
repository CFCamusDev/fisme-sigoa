import { DNI_PATTERN, passwordSchema } from '@sigoa/shared';
import { z } from 'zod';
import type {
  BootstrapAdminInput as AdministratorInput,
  BootstrapAdminInputResult,
} from '../modules/users/application/bootstrap-admin.js';

export type BootstrapAdminInput = AdministratorInput;
export type BootstrapAdminEnvResult = BootstrapAdminInputResult;

const NAME_PART_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;

/** Una cadena vacía o de solo espacios cuenta como variable ausente. */
const emptyAsAbsent = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const trimmedOrAbsent = (value: unknown): unknown =>
  typeof value === 'string' ? emptyAsAbsent(value.trim()) : value;

/**
 * Divide el nombre completo en nombres y apellidos:
 * 2 palabras → nombre + apellido paterno; 3 → 1 nombre + 2 apellidos;
 * 4 o más → las dos últimas son los apellidos.
 */
export function splitFullName(
  fullName: string,
): { names: string; firstSurname: string; secondSurname: string | null } | null {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return null;
  }
  if (words.length === 2) {
    return { names: words[0] as string, firstSurname: words[1] as string, secondSurname: null };
  }
  return {
    names: words.slice(0, -2).join(' '),
    firstSurname: words[words.length - 2] as string,
    secondSurname: words[words.length - 1] as string,
  };
}

const rawSchema = z.object({
  ADMIN_EMAIL: z.preprocess(
    trimmedOrAbsent,
    z
      .string({ error: 'es obligatoria' })
      .max(EMAIL_MAX_LENGTH, `no puede exceder ${EMAIL_MAX_LENGTH} caracteres`)
      .email('debe ser un correo electrónico válido'),
  ),
  ADMIN_FULL_NAME: z.preprocess(
    emptyAsAbsent,
    z
      .string({ error: 'es obligatoria' })
      .max(NAME_PART_MAX_LENGTH * 4, 'es demasiado larga')
      .refine((value) => splitFullName(value) !== null, {
        message: 'debe incluir al menos un nombre y un apellido',
      }),
  ),
  ADMIN_DNI: z.preprocess(
    trimmedOrAbsent,
    z.string({ error: 'es obligatoria' }).regex(DNI_PATTERN, 'debe tener exactamente 8 dígitos'),
  ),
  ADMIN_INITIAL_PASSWORD: z.preprocess(
    emptyAsAbsent,
    z.string({ error: 'es obligatoria' }).pipe(passwordSchema),
  ),
});

/**
 * Carga y valida las variables ADMIN_* del proceso de seed (RNF-003, RNF-039).
 * Los mensajes nombran la variable y nunca incluyen el valor recibido.
 */
export function loadBootstrapAdminEnv(
  rawEnv: Record<string, string | undefined>,
): BootstrapAdminEnvResult {
  const parsed = rawSchema.safeParse({
    ADMIN_EMAIL: rawEnv.ADMIN_EMAIL,
    ADMIN_FULL_NAME: rawEnv.ADMIN_FULL_NAME,
    ADMIN_DNI: rawEnv.ADMIN_DNI,
    ADMIN_INITIAL_PASSWORD: rawEnv.ADMIN_INITIAL_PASSWORD,
  });

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? 'ADMIN_*'),
        message: issue.message,
      })),
    };
  }

  const name = splitFullName(parsed.data.ADMIN_FULL_NAME);
  if (!name) {
    return {
      ok: false,
      issues: [
        { variable: 'ADMIN_FULL_NAME', message: 'debe incluir al menos un nombre y un apellido' },
      ],
    };
  }

  return {
    ok: true,
    value: {
      email: parsed.data.ADMIN_EMAIL.trim().toLowerCase(),
      names: name.names,
      firstSurname: name.firstSurname,
      secondSurname: name.secondSurname,
      dni: parsed.data.ADMIN_DNI,
      password: parsed.data.ADMIN_INITIAL_PASSWORD,
    },
  };
}
