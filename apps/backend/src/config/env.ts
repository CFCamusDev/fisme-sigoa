import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((origins) => origins.length > 0 && !origins.includes('*'), {
      message: 'CORS_ORIGIN must contain valid origins and cannot contain "*"',
    }),
  HSTS_ENABLED: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'false' || val === '0') return false;
      if (val.toLowerCase() === 'true' || val === '1') return true;
    }
    return val;
  }, z.boolean().default(true)),
  TRUST_PROXY: z
    .unknown()
    .default(0)
    .refine((val) => val !== true && val !== 'true', {
      message: 'TRUST_PROXY must be an integer >= 0, boolean true is not allowed',
    })
    .transform((val) => Number(val))
    .pipe(z.number().int().min(0)),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const missingOrInvalid = result.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean);

    const uniqueKeys = Array.from(new Set(missingOrInvalid));
    throw new Error(`Invalid environment variables: ${uniqueKeys.join(', ')}`);
  }

  return result.data;
}

export function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
