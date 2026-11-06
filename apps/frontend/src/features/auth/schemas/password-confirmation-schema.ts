import { z } from 'zod';
import { passwordSchema } from '@sigoa/shared';

/**
 * Esquema de validación para campos de nueva contraseña y confirmación (HU-004, HU-005, RNF-003).
 */
export const passwordConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type PasswordConfirmationFormData = z.infer<typeof passwordConfirmationSchema>;
