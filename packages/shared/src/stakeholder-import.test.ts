import { describe, expect, it } from 'vitest';
import {
  STAKEHOLDER_IMPORT_MAX_ROWS,
  previewStakeholderImportResponseSchema,
  stakeholderImportTemplateQuerySchema,
} from './stakeholder-import.js';

describe('stakeholder-import schemas', () => {
  it('accepts the preview response with nullable document and name', () => {
    const parsed = previewStakeholderImportResponseSchema.parse({
      listId: 'list-1',
      listType: 'TEACHER',
      totals: {
        total: 1,
        new: 0,
        existing: 0,
        alreadyInList: 0,
        invalid: 1,
      },
      rows: [
        {
          rowNumber: 2,
          status: 'INVALID',
          document: null,
          fullName: null,
          errors: ['El DNI es obligatorio y debe tener 8 dígitos.'],
        },
      ],
    });

    expect(parsed.rows[0]?.document).toBeNull();
    expect(parsed.rows[0]?.fullName).toBeNull();
  });

  it('rejects more than 500 rows', () => {
    const rows = Array.from({ length: STAKEHOLDER_IMPORT_MAX_ROWS + 1 }, (_, index) => ({
      rowNumber: index + 2,
      status: 'NEW' as const,
      document: '71234567',
      fullName: 'Docente Prueba',
      errors: [],
    }));

    const result = previewStakeholderImportResponseSchema.safeParse({
      listId: 'list-1',
      listType: 'TEACHER',
      totals: {
        total: rows.length,
        new: rows.length,
        existing: 0,
        alreadyInList: 0,
        invalid: 0,
      },
      rows,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown keys in the template query', () => {
    const valid = stakeholderImportTemplateQuerySchema.safeParse({ type: 'EMPLOYER' });
    const invalid = stakeholderImportTemplateQuerySchema.safeParse({
      type: 'EMPLOYER',
      extra: 'unexpected',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
