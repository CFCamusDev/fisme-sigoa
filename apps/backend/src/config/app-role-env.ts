import { z } from 'zod';

const RESERVED_ROLES = new Set(['postgres', 'sigoa_app', 'public']);

/**
 * Esquema Zod de validación de variables de entorno para el aprovisionamiento
 * del rol restringido de aplicación en PostgreSQL (RS-040, RNF-014, RNF-010).
 */
export const appRoleEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    APP_DB_USER: z
      .string()
      .regex(
        /^[a-z_][a-z0-9_]{2,62}$/,
        'APP_DB_USER debe contener entre 3 y 63 caracteres alfanuméricos en minúsculas o guion bajo, comenzando con letra o guion bajo',
      )
      .refine((user) => !RESERVED_ROLES.has(user), {
        message:
          'APP_DB_USER no puede ser un nombre de rol reservado (postgres, sigoa_app, public)',
      }),
    APP_DB_PASSWORD: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{16,128}$/,
        'APP_DB_PASSWORD debe contener entre 16 y 128 caracteres (solo letras, números, guion y guion bajo) para evitar caracteres de escape en URLs de conexión',
      ),
  })
  .superRefine((data, ctx) => {
    try {
      const url = new URL(data.DATABASE_URL);
      const ownerUsername = decodeURIComponent(url.username);
      if (ownerUsername && ownerUsername.toLowerCase() === data.APP_DB_USER.toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'APP_DB_USER no puede ser igual al usuario de conexión dueño de DATABASE_URL; debe ser un rol restringido diferenciado',
          path: ['APP_DB_USER'],
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL no tiene un formato de URL válido',
        path: ['DATABASE_URL'],
      });
    }
  });

export type AppRoleEnvInput = z.input<typeof appRoleEnvSchema>;

export interface AppRoleEnv {
  databaseUrl: string;
  appDbUser: string;
  appDbPassword: string;
}

/**
 * Carga y valida las variables requeridas para el aprovisionamiento del login de la aplicación.
 */
export function loadAppRoleEnv(rawEnv: Record<string, string | undefined>): AppRoleEnv {
  const parsed = appRoleEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variables de entorno del rol de aplicación inválidas: ${errorDetails}`);
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    appDbUser: parsed.data.APP_DB_USER,
    appDbPassword: parsed.data.APP_DB_PASSWORD,
  };
}
