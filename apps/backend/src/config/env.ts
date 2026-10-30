import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
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
    EMAIL_PROVIDER: z.enum(['resend', 'memory']).default('memory'),
    RESEND_API_KEY: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().min(1).optional(),
    ),
    EMAIL_FROM: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().email('EMAIL_FROM must be a valid email address').optional(),
    ),
    FILE_STORAGE_PROVIDER: z.enum(['cloudinary', 'memory']).default('memory'),
    CLOUDINARY_CLOUD_NAME: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().min(1).optional(),
    ),
    CLOUDINARY_API_KEY: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().min(1).optional(),
    ),
    CLOUDINARY_API_SECRET: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().min(1).optional(),
    ),
    APP_PUBLIC_URL: z.preprocess((val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? undefined : trimmed.replace(/\/+$/, '');
      }
      return val;
    }, z.string().url('APP_PUBLIC_URL must be a valid URL').optional()),
    // Variables de autenticación (HU-001, T-001-10, RNF-004)
    AUTH_JWT_SECRET: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().optional(),
    ),
    AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .superRefine((data, ctx) => {
    if (data.EMAIL_PROVIDER === 'resend') {
      if (!data.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required when EMAIL_PROVIDER is "resend"',
        });
      }
      if (!data.EMAIL_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM is required when EMAIL_PROVIDER is "resend"',
        });
      }
    }

    if (data.EMAIL_PROVIDER === 'memory' && data.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_PROVIDER'],
        message: 'EMAIL_PROVIDER "memory" is not allowed in production environment',
      });
    }

    const hasAnyCloudinary =
      Boolean(data.CLOUDINARY_CLOUD_NAME) ||
      Boolean(data.CLOUDINARY_API_KEY) ||
      Boolean(data.CLOUDINARY_API_SECRET);
    const hasAllCloudinary =
      Boolean(data.CLOUDINARY_CLOUD_NAME) &&
      Boolean(data.CLOUDINARY_API_KEY) &&
      Boolean(data.CLOUDINARY_API_SECRET);

    if (hasAnyCloudinary && !hasAllCloudinary) {
      if (!data.CLOUDINARY_CLOUD_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_CLOUD_NAME'],
          message:
            'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be provided together',
        });
      }
      if (!data.CLOUDINARY_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_KEY'],
          message:
            'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be provided together',
        });
      }
      if (!data.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_SECRET'],
          message:
            'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be provided together',
        });
      }
    }

    if (data.FILE_STORAGE_PROVIDER === 'cloudinary') {
      if (!hasAllCloudinary) {
        if (!data.CLOUDINARY_CLOUD_NAME) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_CLOUD_NAME'],
            message: 'CLOUDINARY_CLOUD_NAME is required when FILE_STORAGE_PROVIDER is "cloudinary"',
          });
        }
        if (!data.CLOUDINARY_API_KEY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_API_KEY'],
            message: 'CLOUDINARY_API_KEY is required when FILE_STORAGE_PROVIDER is "cloudinary"',
          });
        }
        if (!data.CLOUDINARY_API_SECRET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_API_SECRET'],
            message: 'CLOUDINARY_API_SECRET is required when FILE_STORAGE_PROVIDER is "cloudinary"',
          });
        }
      }
    }

    if (data.FILE_STORAGE_PROVIDER === 'memory' && data.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FILE_STORAGE_PROVIDER'],
        message: 'FILE_STORAGE_PROVIDER "memory" is not allowed in production environment',
      });
    }

    if (data.NODE_ENV === 'production') {
      if (!data.APP_PUBLIC_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_PUBLIC_URL'],
          message: 'APP_PUBLIC_URL is required in production environment',
        });
      } else if (!data.APP_PUBLIC_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_PUBLIC_URL'],
          message: 'APP_PUBLIC_URL must use https:// in production environment',
        });
      }

      if (!data.AUTH_JWT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_JWT_SECRET'],
          message: 'AUTH_JWT_SECRET is required in production environment',
        });
      } else if (data.AUTH_JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_JWT_SECRET'],
          message: 'AUTH_JWT_SECRET must be at least 32 characters in production environment',
        });
      } else if (
        /^(.)\1+$/.test(data.AUTH_JWT_SECRET) ||
        data.AUTH_JWT_SECRET.includes('12345678901234567890123456789012') ||
        data.AUTH_JWT_SECRET.toLowerCase().includes('change-me') ||
        data.AUTH_JWT_SECRET.toLowerCase().includes('placeholder')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_JWT_SECRET'],
          message: 'AUTH_JWT_SECRET is too weak or uses a predictable pattern',
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    APP_PUBLIC_URL: data.APP_PUBLIC_URL ?? 'http://localhost:5173',
    AUTH_JWT_SECRET: data.AUTH_JWT_SECRET ?? randomBytes(32).toString('hex'),
  }));

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
