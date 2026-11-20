import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { ProcessExecution } from '../../domain/entities/process-execution.js';
import { DuplicateProcessExecutionError } from '../../domain/errors/duplicate-process-execution-error.js';
import { ExecutionStatusConflictError } from '../../domain/errors/execution-status-conflict-error.js';
import { PrismaProcessCatalogVersionReader } from './prisma-process-catalog-version-reader.js';
import { PrismaProcessExecutionRepository } from './prisma-process-execution-repository.js';
import { PrismaProcessProgramResolver } from './prisma-process-program-resolver.js';
import { PrismaProcessSemesterReader } from './prisma-process-semester-reader.js';

describe('PrismaProcessExecutionRepository Integration (PostgreSQL real, T-027-18)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaProcessExecutionRepository(uow);
  const programResolver = new PrismaProcessProgramResolver(uow);
  const catalogVersionReader = new PrismaProcessCatalogVersionReader(uow);
  const semesterReader = new PrismaProcessSemesterReader(uow);

  const NOW = new Date('2027-01-15T10:00:00.000Z');

  async function createProgram(id = 'prog-1', code = 'EPIS') {
    await prisma.program.create({
      data: {
        id,
        code,
        name: 'Ingeniería de Sistemas',
        faculty: 'FISME',
      },
    });
    return id;
  }

  async function createCatalogVersion(params: {
    id?: string;
    programId: string;
    number?: number;
    status?: 'DRAFT' | 'IN_VALIDATION' | 'APPROVED' | 'HISTORICAL';
  }) {
    const id = params.id ?? 'cv-1';
    await prisma.catalogVersion.create({
      data: {
        id,
        programId: params.programId,
        number: params.number ?? 1,
        status: params.status ?? 'APPROVED',
      },
    });
    return {
      id,
      programId: params.programId,
      status: params.status ?? ('APPROVED' as const),
    };
  }

  async function createSemester(id = 'sem-1', code = '2027-I') {
    await prisma.semester.create({
      data: {
        id,
        code,
        startDate: new Date('2027-03-01T00:00:00.000Z'),
        endDate: new Date('2027-07-15T00:00:00.000Z'),
      },
    });
    return { id, code };
  }

  it('persists and reads back an execution', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, number: 2, status: 'APPROVED' });

    const execution = ProcessExecution.create({
      id: 'exec-1',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });

    await repository.save(execution);

    const page = await repository.list({ page: 1, pageSize: 20 });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.execution.id).toBe('exec-1');
    expect(page.items[0]?.execution.name).toBe('Medición anual de OE 2027');
    expect(page.items[0]?.execution.status).toBe('PLANNED');
    expect(page.items[0]?.semesterCode).toBeNull();
    expect(page.items[0]?.catalogVersionNumber).toBe(2);
    expect(await programResolver.getCurrentProgramId()).toBe(programId);
  }, 5_000);

  it('rejects a duplicate name in the program ignoring case', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });

    await repository.save(
      ProcessExecution.create({
        id: 'exec-1',
        programId,
        type: 'P612',
        name: 'Medición Anual 2027',
        year: 2027,
        catalogVersion: version,
        actorId: 'user-1',
        now: NOW,
      }),
    );

    await expect(
      repository.save(
        ProcessExecution.create({
          id: 'exec-2',
          programId,
          type: 'P623',
          name: 'medición anual 2027',
          year: 2027,
          catalogVersion: version,
          actorId: 'user-1',
          now: NOW,
        }),
      ),
    ).rejects.toBeInstanceOf(DuplicateProcessExecutionError);
  }, 5_000);

  it('allows reusing the name of a voided execution', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });

    await prisma.processExecution.create({
      data: {
        id: 'exec-voided',
        programId,
        type: 'P612',
        name: 'Medición anual de OE 2027',
        year: 2027,
        catalogVersionId: version.id,
        status: 'VOIDED',
        createdBy: 'user-1',
      },
    });

    const activeExecution = ProcessExecution.create({
      id: 'exec-new',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });

    await expect(repository.save(activeExecution)).resolves.toBeUndefined();
  }, 5_000);

  it('lets exactly one of two concurrent saves with the same name win', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });

    const first = ProcessExecution.create({
      id: 'exec-c1',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });
    const second = ProcessExecution.create({
      id: 'exec-c2',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });

    const results = await Promise.allSettled([repository.save(first), repository.save(second)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(DuplicateProcessExecutionError);
  }, 5_000);

  it('rejects P622 without a semester at the database level', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });

    await expect(
      prisma.processExecution.create({
        data: {
          id: 'exec-bad-p622',
          programId,
          type: 'P622',
          name: 'Medición directa sin semestre',
          year: 2027,
          semesterId: null,
          catalogVersionId: version.id,
          status: 'PLANNED',
          createdBy: 'user-1',
        },
      }),
    ).rejects.toThrow();
  }, 5_000);

  it('lists with filters, pagination and joined semester and version', async () => {
    const programId = await createProgram();
    const vApproved = await createCatalogVersion({
      id: 'cv-app',
      programId,
      number: 3,
      status: 'APPROVED',
    });
    const vValidation = await createCatalogVersion({
      id: 'cv-val',
      programId,
      number: 4,
      status: 'IN_VALIDATION',
    });
    const sem2027 = await createSemester('sem-2027-1', '2027-I');

    await repository.save(
      ProcessExecution.create({
        id: 'exec-1',
        programId,
        type: 'P612',
        year: 2026,
        catalogVersion: vApproved,
        actorId: 'user-1',
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    await repository.save(
      ProcessExecution.create({
        id: 'exec-2',
        programId,
        type: 'P622',
        year: 2027,
        semester: sem2027,
        catalogVersion: vApproved,
        actorId: 'user-1',
        now: new Date('2027-01-01T00:00:00.000Z'),
      }),
    );
    await repository.save(
      ProcessExecution.create({
        id: 'exec-3',
        programId,
        type: 'P611',
        year: 2027,
        catalogVersion: vValidation,
        actorId: 'user-1',
        now: new Date('2027-02-01T00:00:00.000Z'),
      }),
    );

    const page1 = await repository.list({ year: 2027, page: 1, pageSize: 1 });
    expect(page1.total).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.execution.id).toBe('exec-3');
    expect(page1.items[0]?.catalogVersionNumber).toBe(4);

    const p622Page = await repository.list({
      type: 'P622',
      year: 2027,
      status: 'PLANNED',
      page: 1,
      pageSize: 20,
    });
    expect(p622Page.total).toBe(1);
    expect(p622Page.items[0]?.semesterCode).toBe('2027-I');
    expect(p622Page.items[0]?.catalogVersionNumber).toBe(3);
  }, 5_000);

  it('reads the version and the semester by id', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({
      id: 'cv-read',
      programId,
      number: 5,
      status: 'IN_VALIDATION',
    });
    const semester = await createSemester('sem-read', '2027-II');

    const foundVersion = await catalogVersionReader.findById(version.id);
    expect(foundVersion).toEqual({
      id: 'cv-read',
      number: 5,
      programId,
      status: 'IN_VALIDATION',
    });

    const foundSemester = await semesterReader.findById(semester.id);
    expect(foundSemester).toEqual({
      id: 'sem-read',
      code: '2027-II',
    });
  }, 5_000);

  it('returns null for an unknown version or semester', async () => {
    expect(await catalogVersionReader.findById('missing-cv')).toBeNull();
    expect(await semesterReader.findById('missing-sem')).toBeNull();
  }, 5_000);

  it('findByIdForUpdate returns the row', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });
    const execution = ProcessExecution.create({
      id: 'exec-lock-1',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });
    await repository.save(execution);

    const locked = await uow.run(async () => repository.findByIdForUpdate('exec-lock-1'));
    expect(locked?.id).toBe('exec-lock-1');
    expect(locked?.status).toBe('PLANNED');

    const missing = await uow.run(async () => repository.findByIdForUpdate('missing-exec'));
    expect(missing).toBeNull();
  }, 5_000);

  it('updateStatus changes the status only from the expected one', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });
    const execution = ProcessExecution.create({
      id: 'exec-upd-1',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });
    await repository.save(execution);

    const advanced = execution.advance({
      actorId: 'user-2',
      now: new Date('2027-01-20T10:00:00.000Z'),
    });

    await repository.updateStatus(advanced, 'PLANNED');

    const reloaded = await repository.findById('exec-upd-1');
    expect(reloaded?.status).toBe('IN_PROGRESS');
    expect(reloaded?.updatedBy).toBe('user-2');
  }, 5_000);

  it('updateStatus fails with a conflict when the status differs', async () => {
    const programId = await createProgram();
    const version = await createCatalogVersion({ programId, status: 'APPROVED' });
    const execution = ProcessExecution.create({
      id: 'exec-conflict-1',
      programId,
      type: 'P612',
      year: 2027,
      catalogVersion: version,
      actorId: 'user-1',
      now: NOW,
    });
    await repository.save(execution);

    const advanced = execution.advance({
      actorId: 'user-2',
      now: new Date('2027-01-20T10:00:00.000Z'),
    });

    await expect(repository.updateStatus(advanced, 'IN_PROGRESS')).rejects.toBeInstanceOf(
      ExecutionStatusConflictError,
    );

    const reloaded = await repository.findById('exec-conflict-1');
    expect(reloaded?.status).toBe('PLANNED');
  }, 5_000);
});
