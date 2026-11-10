import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListSemestersUseCase } from './list-semesters.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import { Semester } from '../domain/entities/semester.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';

describe('ListSemestersUseCase Unit Tests (T-010-05, CA1, D5, D6, RS-002)', () => {
  let semesterReader: SemesterReader;
  let permissionChecker: ParametersPermissionChecker;
  let useCase: ListSemestersUseCase;

  beforeEach(() => {
    semesterReader = {
      list: vi.fn().mockResolvedValue([]),
    };

    permissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new ListSemestersUseCase({
      semesterReader,
      permissionChecker,
    });
  });

  it('verifies parametro.ver permission with GLOBAL scope and lists semesters (CA1, D5)', async () => {
    const sem2 = Semester.create({
      id: 'sem_2',
      code: '2027-II',
      startDate: '2027-08-01',
      endDate: '2027-12-31',
      createdBy: 'admin_1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-11-09T14:00:00.000Z'),
    });

    const sem1 = Semester.create({
      id: 'sem_1',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdBy: 'admin_1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    vi.mocked(semesterReader.list).mockResolvedValueOnce([sem2, sem1]);

    const response = await useCase.execute({ actorId: 'user_viewer_1' });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user_viewer_1',
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });

    expect(semesterReader.list).toHaveBeenCalledTimes(1);

    expect(response).toEqual({
      items: [
        {
          id: 'sem_2',
          code: '2027-II',
          startDate: '2027-08-01',
          endDate: '2027-12-31',
          updatedAt: '2026-11-09T14:00:00.000Z',
        },
        {
          id: 'sem_1',
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
          updatedAt: '2026-11-09T10:00:00.000Z',
        },
      ],
    });
  });

  it('rejects when permission is denied and does not call reader (RS-002, RNF-009)', async () => {
    vi.mocked(permissionChecker.assertAllowed).mockRejectedValueOnce(
      new ForbiddenError('No tienes permiso para ver parámetros.'),
    );

    await expect(useCase.execute({ actorId: 'unauthorized_user' })).rejects.toThrow(ForbiddenError);

    expect(semesterReader.list).not.toHaveBeenCalled();
  });

  it('returns empty items array when no semesters exist (valid minimal case)', async () => {
    vi.mocked(semesterReader.list).mockResolvedValueOnce([]);

    const response = await useCase.execute({ actorId: 'user_1' });

    expect(response).toEqual({
      items: [],
    });
  });
});
