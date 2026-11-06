import { z } from 'zod';

export const roleStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type RoleStatus = z.infer<typeof roleStatusSchema>;

export const roleSummarySchema = z
  .object({
    id: z.string().min(1, 'El identificador de rol es requerido'),
    code: z.string().min(1, 'El código de rol es requerido'),
    name: z.string().min(1, 'El nombre de rol es requerido'),
    description: z.string().nullable(),
    isPredefined: z.boolean(),
  })
  .strict();

export type RoleSummary = z.infer<typeof roleSummarySchema>;

export const listRolesResponseSchema = z
  .object({
    items: z.array(roleSummarySchema),
  })
  .strict();

export type ListRolesResponse = z.infer<typeof listRolesResponseSchema>;
