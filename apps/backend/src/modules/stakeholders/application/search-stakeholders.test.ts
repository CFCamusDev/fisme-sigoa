import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderReader } from '../domain/ports/stakeholder-reader.js';
import { SearchStakeholdersUseCase } from './search-stakeholders.js';

const NOW = new Date('2026-11-16T10:00:00.000Z');

function makePerson(id: string, fullName: string, dni: string): Stakeholder {
  return Stakeholder.register({
    id,
    kind: 'PERSON',
    fullName,
    dni,
    actorId: 'user-1',
    now: NOW,
  });
}

describe('SearchStakeholdersUseCase (HU-021, T-021-09, T-021-23)', () => {
  let stakeholderReader: MockProxy<StakeholderReader>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let useCase: SearchStakeholdersUseCase;

  beforeEach(() => {
    stakeholderReader = mock<StakeholderReader>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    useCase = new SearchStakeholdersUseCase({
      stakeholderReader,
      permissionChecker,
    });
  });

  it('denies the action without the permission and reads nothing', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-2',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(stakeholderReader.list).not.toHaveBeenCalled();
  });

  it('delegates filters and pagination, computes totalPages, and parses response', async () => {
    const items = [makePerson('stk-1', 'Ana Torres', '12345678')];
    stakeholderReader.list.mockResolvedValue({ items, total: 21 });

    const result = await useCase.execute({
      actorId: 'user-2',
      search: '  Ana  ',
      kind: 'PERSON',
      status: 'ACTIVE',
      document: '12345678',
      page: 2,
      pageSize: 10,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-2',
      permission: 'constituyente.ver',
      scope: 'GLOBAL',
    });
    expect(stakeholderReader.list).toHaveBeenCalledWith({
      search: 'Ana',
      kind: 'PERSON',
      status: 'ACTIVE',
      document: '12345678',
      page: 2,
      pageSize: 10,
    });
    expect(result.total).toBe(21);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('stk-1');
  });

  it('returns empty items and totalPages 0 when there are no matches', async () => {
    stakeholderReader.list.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute({
      actorId: 'user-2',
      search: '',
      page: 1,
      pageSize: 20,
    });

    expect(stakeholderReader.list).toHaveBeenCalledWith({
      search: undefined,
      kind: undefined,
      status: undefined,
      document: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(result).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
