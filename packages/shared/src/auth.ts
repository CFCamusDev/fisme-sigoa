import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .email('El formato del correo electrónico es inválido')
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .max(128, 'La contraseña no puede exceder 128 caracteres'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z
  .object({
    id: z.string().min(1),
    names: z.string().min(1),
    firstSurname: z.string().min(1),
    secondSurname: z.string().nullable(),
    email: z.string().email(),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    accessTokenExpiresAt: z.string().datetime(),
    refreshToken: z.string().min(1),
    refreshTokenExpiresAt: z.string().datetime(),
    user: authUserSchema,
  })
  .strict();

export type LoginResponse = z.infer<typeof loginResponseSchema>;
