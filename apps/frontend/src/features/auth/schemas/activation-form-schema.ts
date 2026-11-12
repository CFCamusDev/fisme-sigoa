import {
  passwordConfirmationSchema,
  type PasswordConfirmationFormData,
} from './password-confirmation-schema';

/**
 * Esquema de validación del formulario de activación de cuenta (HU-004, RF-004, RNF-003, CA3).
 * Incluye la validación de la política de contraseñas y la confirmación en interfaz.
 */
export const activationFormSchema = passwordConfirmationSchema;

export type ActivationFormData = PasswordConfirmationFormData;
