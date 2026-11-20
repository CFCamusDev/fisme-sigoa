import { describe, expect, it } from 'vitest';
import {
  STAKEHOLDER_LIST_ID_MAX_LENGTH,
  STAKEHOLDER_LIST_PDF_ANNEX_CODE,
  addStakeholderListMemberRequestSchema,
  copyStakeholderListRequestSchema,
  createStakeholderListRequestSchema,
  exportStakeholderListPdfParamsSchema,
  exportStakeholderListPdfQuerySchema,
  listStakeholderListsQuerySchema,
  stakeholderListDtoSchema,
  stakeholderListMemberDtoSchema,
} from './stakeholder-lists.js';

describe('stakeholder-lists shared schemas', () => {
  it('rejects unknown fields', () => {
    const createResult = createStakeholderListRequestSchema.safeParse({
      type: 'EMPLOYER',
      year: 2027,
      extra: 'no-permitido',
    });
    expect(createResult.success).toBe(false);

    const addResult = addStakeholderListMemberRequestSchema.safeParse({
      stakeholderId: 'stk-1',
      unknown: true,
    });
    expect(addResult.success).toBe(false);

    const copyResult = copyStakeholderListRequestSchema.safeParse({
      year: 2028,
      extra: 1,
    });
    expect(copyResult.success).toBe(false);
  });

  it('rejects a year out of range', () => {
    expect(
      createStakeholderListRequestSchema.safeParse({ type: 'EMPLOYER', year: 1999 }).success,
    ).toBe(false);
    expect(
      createStakeholderListRequestSchema.safeParse({ type: 'EMPLOYER', year: 2101 }).success,
    ).toBe(false);
    expect(copyStakeholderListRequestSchema.safeParse({ year: 1990 }).success).toBe(false);
  });

  it('rejects includeMembers without type and year', () => {
    expect(
      listStakeholderListsQuerySchema.safeParse({
        includeMembers: 'true',
        type: 'EMPLOYER',
      }).success,
    ).toBe(false);

    expect(
      listStakeholderListsQuerySchema.safeParse({
        includeMembers: 'true',
        year: '2027',
      }).success,
    ).toBe(false);

    const valid = listStakeholderListsQuerySchema.safeParse({
      includeMembers: 'true',
      type: 'EMPLOYER',
      year: '2027',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.includeMembers).toBe(true);
      expect(valid.data.year).toBe(2027);
    }
  });

  it('bounds page and pageSize', () => {
    expect(listStakeholderListsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listStakeholderListsQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
    expect(listStakeholderListsQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(listStakeholderListsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);

    const defaults = listStakeholderListsQuerySchema.parse({});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(20);
    expect(defaults.includeMembers).toBe(false);
  });

  it('accepts nullable optional fields in the DTO', () => {
    const member = stakeholderListMemberDtoSchema.parse({
      id: 'mem-1',
      listId: 'list-1',
      stakeholderId: 'stk-1',
      fullName: 'Docente Uno',
      institution: null,
      ruc: null,
      sector: null,
      representative: null,
      activity: null,
      email: null,
      mobile: null,
      position: null,
      graduationYear: null,
      cycle: null,
      createdAt: '2026-11-16T10:00:00.000Z',
    });

    const list = stakeholderListDtoSchema.parse({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      studyPlanNumber: null,
      version: null,
      memberCount: 1,
      members: [member],
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    });

    expect(list.studyPlanNumber).toBeNull();
    expect(list.members).toHaveLength(1);
  });

  it('validates export pdf params and rejects empty, oversized or unknown fields', () => {
    expect(STAKEHOLDER_LIST_PDF_ANNEX_CODE).toBe('FO-03');

    const parsed = exportStakeholderListPdfParamsSchema.parse({ id: '  list-1  ' });
    expect(parsed.id).toBe('list-1');

    expect(exportStakeholderListPdfParamsSchema.safeParse({ id: '' }).success).toBe(false);
    expect(exportStakeholderListPdfParamsSchema.safeParse({ id: '   ' }).success).toBe(false);
    expect(
      exportStakeholderListPdfParamsSchema.safeParse({
        id: 'a'.repeat(STAKEHOLDER_LIST_ID_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      exportStakeholderListPdfParamsSchema.safeParse({
        id: 'list-1',
        extra: 'no-permitido',
      }).success,
    ).toBe(false);

    expect(exportStakeholderListPdfQuerySchema.safeParse({}).success).toBe(true);
    expect(exportStakeholderListPdfQuerySchema.safeParse({ format: 'pdf' }).success).toBe(false);
  });
});
