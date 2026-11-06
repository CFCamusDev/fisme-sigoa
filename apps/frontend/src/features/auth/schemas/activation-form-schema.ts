import { z } from 'zod';
import { passwordSchema } from '@sigoa/shared';

/**
 * Esquema de validación del formulario de activación de cuenta (HU-004, RF-004, RNF-003, CA3).
 * Incluye la validación de la política de contraseñas y la confirmación en interfaz.
 */
export const activationFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type ActivationFormData = z.infer<typeof activationFormSchema>;
