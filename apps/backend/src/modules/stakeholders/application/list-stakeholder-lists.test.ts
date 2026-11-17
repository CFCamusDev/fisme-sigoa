import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import type { StakeholderListReader } from '../domain/ports/stakeholder-list-reader.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { ListStakeholderListsUseCase } from './list-stakeholder-lists.js';

const NOW = new Date('2026-11-16T12:00:00.000Z');

describe('ListStakeholderListsUseCase (HU-022, T-022-13)', () => {
  let stakeholderListReader: MockProxy<StakeholderListReader>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let useCase: ListStakeholderListsUseCase;

  beforeEach(() => {
    stakeholderListReader = mock<StakeholderListReader>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    useCase = new ListStakeholderListsUseCase({
      stakeholderListReader,
      permissionChecker,
    });
  });

  it('denies a user without constituyente.ver', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError());

    await expect(
      useCase.execute({
        actorId: 'user-2',
        includeMembers: false,
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(stakeholderListReader.list).not.toHaveBeenCalled();
  });

  it('returns the page with totalPages and parsed DTOs', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: '2024-II',
      version: 'v1.0',
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListReader.list.mockResolvedValueOnce({
      items: [{ list, memberCount: 3, members: null }],
      total: 25,
    });

    const result = await useCase.execute({
      actorId: 'user-1',
      includeMembers: false,
      page: 2,
      pageSize: 10,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'constituyente.ver',
      scope: 'GLOBAL',
    });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.memberCount).toBe(3);
    expect(result.items[0]?.members).toBeNull();
  });

  it('passes includeMembers to the reader', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const teacher = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Luis Paredes',
      dni: '12345678',
      email: 'luis@example.test',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });
    const member = StakeholderListMember.create({
      id: 'mem-1',
      list,
      stakeholder: teacher,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListReader.list.mockResolvedValueOnce({
      items: [{ list, memberCount: 1, members: [member] }],
      total: 1,
    });

    const result = await useCase.execute({
      actorId: 'user-1',
      type: 'TEACHER',
      year: 2027,
      includeMembers: true,
      page: 1,
      pageSize: 20,
    });

    expect(stakeholderListReader.list).toHaveBeenCalledWith({
      type: 'TEACHER',
      year: 2027,
      includeMembers: true,
      page: 1,
      pageSize: 20,
    });
    expect(result.items[0]?.members).toHaveLength(1);
    expect(result.items[0]?.members?.[0]?.fullName).toBe('Luis Paredes');
  });
});
