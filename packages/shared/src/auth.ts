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
    refreshTokenExpiresAt: z.string().datetime(),
    user: authUserSchema,
  })
  .strict();

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = loginResponseSchema;

export type RefreshResponse = LoginResponse;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const ACTIVATION_TOKEN_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 10 caracteres')
  .max(PASSWORD_MAX_LENGTH, 'La contraseña no puede exceder 128 caracteres')
  .regex(/\p{L}/u, 'La contraseña debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

export const accountTokenSchema = z
  .string()
  .min(1, 'El token de activación es obligatorio')
  .max(ACTIVATION_TOKEN_MAX_LENGTH, 'El token de activación no puede exceder 128 caracteres');

export const activateAccountRequestSchema = z
  .object({
    token: accountTokenSchema,
    password: passwordSchema,
  })
  .strict();

export type ActivateAccountRequest = z.infer<typeof activateAccountRequestSchema>;

export const activateAccountResponseSchema = z
  .object({
    status: z.literal('ACTIVE'),
  })
  .strict();

export type ActivateAccountResponse = z.infer<typeof activateAccountResponseSchema>;

export const forgotPasswordRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'El correo electrónico es obligatorio')
      .max(254, 'El correo electrónico no puede exceder 254 caracteres')
      .email('El formato del correo electrónico es inválido')
      .transform((val) => val.toLowerCase()),
  })
  .strict();

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordResponseSchema = z
  .object({
    status: z.literal('RECEIVED'),
  })
  .strict();

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordRequestSchema = z
  .object({
    token: accountTokenSchema,
    password: passwordSchema,
  })
  .strict();

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordResponseSchema = z
  .object({
    status: z.literal('PASSWORD_RESET'),
  })
  .strict();

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
