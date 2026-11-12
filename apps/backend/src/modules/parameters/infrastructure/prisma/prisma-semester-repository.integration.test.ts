import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaSemesterRepository } from './prisma-semester-repository.js';
import { Semester } from '../../domain/entities/semester.js';
import { SemesterCodeAlreadyExistsError, SemesterOverlapError } from '../../domain/errors/index.js';

describe('PrismaSemesterRepository Integration (PostgreSQL real, parameters module, T-010-15)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const semesterRepo = new PrismaSemesterRepository(uow);

  beforeEach(async () => {
    await prisma.semester.deleteMany();
  });

  it('adds and lists semesters ordered by startDate descending (CA1, D6)', async () => {
    const sem1 = Semester.create({
      id: 'sem_int_1',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdBy: 'admin-1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const sem2 = Semester.create({
      id: 'sem_int_2',
      code: '2027-II',
      startDate: '2027-08-01',
      endDate: '2027-12-31',
      createdBy: 'admin-1',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await semesterRepo.add(sem1);
    await semesterRepo.add(sem2);

    const list = await semesterRepo.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.code).toBe('2027-II');
    expect(list[0]?.startDate).toBe('2027-08-01');
    expect(list[0]?.endDate).toBe('2027-12-31');
    expect(list[1]?.code).toBe('2027-I');
    expect(list[1]?.startDate).toBe('2027-03-01');
    expect(list[1]?.endDate).toBe('2027-07-31');
  }, 15_000);

  it('throws typed SemesterCodeAlreadyExistsError when code violates unique constraint', async () => {
    const sem1 = Semester.create({
      id: 'sem_int_code_1',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await semesterRepo.add(sem1);

    const semDuplicate = Semester.create({
      id: 'sem_int_code_2',
      code: '2027-I', // mismo código
      startDate: '2028-03-01', // fechas distintas
      endDate: '2028-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(semesterRepo.add(semDuplicate)).rejects.toThrow(SemesterCodeAlreadyExistsError);
  }, 15_000);

  it('translates database exclusion constraint violation to SemesterOverlapError (CA2, D3)', async () => {
    const sem1 = Semester.create({
      id: 'sem_int_ex_1',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await semesterRepo.add(sem1);

    // Semestre con fechas que se superponen (comparte frontera 2027-07-31)
    const semOverlap = Semester.create({
      id: 'sem_int_ex_2',
      code: '2027-II',
      startDate: '2027-07-31',
      endDate: '2027-12-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(semesterRepo.add(semOverlap)).rejects.toThrow(SemesterOverlapError);
  }, 15_000);

  it('lockAndListAll throws when called outside an active transaction', async () => {
    await expect(semesterRepo.lockAndListAll()).rejects.toThrow(
      'lockAndListAll solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  }, 15_000);

  it('lockAndListAll acquires lock and lists all semesters ordered by startDate ascending within transaction', async () => {
    const sem2 = Semester.create({
      id: 'sem_tx_2',
      code: '2027-II',
      startDate: '2027-08-01',
      endDate: '2027-12-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const sem1 = Semester.create({
      id: 'sem_tx_1',
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await semesterRepo.add(sem2);
    await semesterRepo.add(sem1);

    const lockedSemesters = await uow.run(async () => {
      return semesterRepo.lockAndListAll();
    });

    expect(lockedSemesters).toHaveLength(2);
    expect(lockedSemesters[0]?.code).toBe('2027-I');
    expect(lockedSemesters[1]?.code).toBe('2027-II');
  }, 15_000);
});
