import { z } from 'zod';

export const userParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'El identificador de usuario es obligatorio')
    .max(64, 'El identificador de usuario no puede exceder 64 caracteres'),
});

export type UserParam = z.infer<typeof userParamSchema>;
