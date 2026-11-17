import { z } from 'zod';
import { stakeholderListTypeSchema } from './stakeholder-lists.js';

export const STAKEHOLDER_IMPORT_MAX_FILE_BYTES = 2_097_152;
export const STAKEHOLDER_IMPORT_MAX_ROWS = 500;
export const STAKEHOLDER_IMPORT_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const STAKEHOLDER_IMPORT_ROW_STATUSES = [
  'NEW',
  'EXISTING',
  'ALREADY_IN_LIST',
  'INVALID',
] as const;

export const stakeholderImportRowStatusSchema = z.enum(STAKEHOLDER_IMPORT_ROW_STATUSES);
export type StakeholderImportRowStatusValue = z.infer<typeof stakeholderImportRowStatusSchema>;

export const stakeholderImportRowDtoSchema = z.object({
  rowNumber: z.number().int().min(2),
  status: stakeholderImportRowStatusSchema,
  document: z.string().nullable(),
  fullName: z.string().nullable(),
  errors: z.array(z.string()),
});
export type StakeholderImportRowDto = z.infer<typeof stakeholderImportRowDtoSchema>;

const nonNegativeInt = z.number().int().min(0);

export const previewStakeholderImportResponseSchema = z.object({
  listId: z.string().min(1),
  listType: stakeholderListTypeSchema,
  totals: z.object({
    total: nonNegativeInt,
    new: nonNegativeInt,
    existing: nonNegativeInt,
    alreadyInList: nonNegativeInt,
    invalid: nonNegativeInt,
  }),
  rows: z.array(stakeholderImportRowDtoSchema).max(STAKEHOLDER_IMPORT_MAX_ROWS),
});
export type PreviewStakeholderImportResponse = z.infer<
  typeof previewStakeholderImportResponseSchema
>;

export const confirmStakeholderImportRejectedRowSchema = z.object({
  rowNumber: z.number().int().min(2),
  errors: z.array(z.string()),
});
export type ConfirmStakeholderImportRejectedRow = z.infer<
  typeof confirmStakeholderImportRejectedRowSchema
>;

export const confirmStakeholderImportResponseSchema = z.object({
  importId: z.string().min(1),
  listId: z.string().min(1),
  totals: z.object({
    created: nonNegativeInt,
    reused: nonNegativeInt,
    added: nonNegativeInt,
    alreadyInList: nonNegativeInt,
    rejected: nonNegativeInt,
  }),
  rejectedRows: z.array(confirmStakeholderImportRejectedRowSchema).max(STAKEHOLDER_IMPORT_MAX_ROWS),
});
export type ConfirmStakeholderImportResponse = z.infer<
  typeof confirmStakeholderImportResponseSchema
>;

export const stakeholderImportTemplateQuerySchema = z
  .object({
    type: stakeholderListTypeSchema,
  })
  .strict();
export type StakeholderImportTemplateQuery = z.infer<typeof stakeholderImportTemplateQuerySchema>;
