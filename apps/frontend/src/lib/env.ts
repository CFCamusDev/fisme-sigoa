import { z } from 'zod';

export const envSchema = z.object({
  VITE_API_URL: z
    .string({
      error: 'La variable de entorno VITE_API_URL es requerida.',
    })
    .url('La variable de entorno VITE_API_URL debe ser una URL válida.'),
});

export type FrontendEnv = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): FrontendEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join(', ');
    throw new Error(`Error en las variables de entorno de la aplicación frontend: ${errorDetails}`);
  }

  return result.data;
}

let cachedEnv: FrontendEnv | null = null;

export function getEnv(): FrontendEnv {
  if (!cachedEnv) {
    const source =
      typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env as unknown as Record<string, unknown>)
        : {};
    cachedEnv = parseEnv(source);
  }
  return cachedEnv;
}

export const env: FrontendEnv = new Proxy({} as FrontendEnv, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof FrontendEnv];
  },
});
