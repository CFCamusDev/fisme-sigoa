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

  it('preserves the exact order provided by the semester reader (D6)', async () => {
    const semA = Semester.create({
      id: 'sem_a',
      code: '2028-I',
      startDate: '2028-03-01',
      endDate: '2028-07-31',
      createdBy: 'admin_1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    const semB = Semester.create({
      id: 'sem_b',
      code: '2027-II',
      startDate: '2027-08-01',
      endDate: '2027-12-31',
      createdBy: 'admin_1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    const semC = Semester.create({
      id: 'sem_c',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdBy: 'admin_1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date('2026-11-09T10:00:00.000Z'),
    });

    // Reader yields them in specific order
    vi.mocked(semesterReader.list).mockResolvedValueOnce([semA, semB, semC]);

    const response = await useCase.execute({ actorId: 'user_1' });

    expect(response.items.map((i) => i.id)).toEqual(['sem_a', 'sem_b', 'sem_c']);
    expect(response.items.map((i) => i.code)).toEqual(['2028-I', '2027-II', '2027-I']);
  });

  it('propagates reader errors without wrapping or swallowing them', async () => {
    const dbError = new Error('Database connection failed');
    vi.mocked(semesterReader.list).mockRejectedValueOnce(dbError);

    await expect(useCase.execute({ actorId: 'user_1' })).rejects.toThrow(
      'Database connection failed',
    );
  });

  it('fails if reader returns an item incompatible with the response contract', async () => {
    // Objeto corrupto que viola el esquema de respuesta
    const corruptedSemester = {
      id: 'sem_corrupt',
      code: 'INVALID-CODE',
      startDate: 'invalid-date',
      endDate: 'invalid-date',
      updatedAt: new Date(),
    } as unknown as Semester;

    vi.mocked(semesterReader.list).mockResolvedValueOnce([corruptedSemester]);

    await expect(useCase.execute({ actorId: 'user_1' })).rejects.toThrow();
  });

  it('returns all 25 semesters without silent truncation (D6)', async () => {
    const bulkSemesters = Array.from({ length: 25 }, (_, idx) => {
      const year = 2000 + idx;
      return Semester.create({
        id: `sem_${year}`,
        code: `${year}-I`,
        startDate: `${year}-03-01`,
        endDate: `${year}-07-31`,
        createdBy: 'admin_1',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date('2026-11-09T10:00:00.000Z'),
      });
    });

    vi.mocked(semesterReader.list).mockResolvedValueOnce(bulkSemesters);

    const response = await useCase.execute({ actorId: 'user_1' });

    expect(response.items).toHaveLength(25);
    expect(response.items[0]?.code).toBe('2000-I');
    expect(response.items[24]?.code).toBe('2024-I');
  });
});
