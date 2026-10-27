import { z } from 'zod';

export const createReferenceItemSchema = z.object({
  code: z
    .string({ message: 'El código es requerido' })
    .trim()
    .min(1, 'El código no puede estar vacío')
    .max(50, 'El código no puede exceder 50 caracteres'),
  title: z
    .string({ message: 'El título es requerido' })
    .trim()
    .min(1, 'El título no puede estar vacío')
    .max(200, 'El título no puede exceder 200 caracteres'),
});

export type CreateReferenceItemInput = z.infer<typeof createReferenceItemSchema>;
