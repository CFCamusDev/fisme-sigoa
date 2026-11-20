import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ConflictError, ForbiddenError } from '../../../shared/errors/app-error.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { StakeholderListNotFoundError } from '../domain/errors/stakeholder-list-not-found-error.js';
import type { AnnexPdfGenerator } from '../domain/ports/annex-pdf-generator.js';
import type { StakeholderListReader } from '../domain/ports/stakeholder-list-reader.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { ExportStakeholderListPdfUseCase } from './export-stakeholder-list-pdf.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('ExportStakeholderListPdfUseCase (T-026-07, CA1)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let stakeholderListReader: MockProxy<StakeholderListReader>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let annexPdfGenerator: MockProxy<AnnexPdfGenerator>;
  let useCase: ExportStakeholderListPdfUseCase;
  const samplePdf = Buffer.from('%PDF-1.4\nAnnex 3');

  const requestedList = StakeholderList.reconstitute({
    id: 'list-emp-2026',
    programId: 'prog-1',
    type: 'EMPLOYER',
    year: 2026,
    studyPlanNumber: '2024',
    version: 'v1.0',
    createdBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW,
  });

  const teacherList = StakeholderList.reconstitute({
    id: 'list-tea-2026',
    programId: 'prog-1',
    type: 'TEACHER',
    year: 2026,
    studyPlanNumber: '2024',
    version: 'v1.0',
    createdBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW,
  });

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    stakeholderListReader = mock<StakeholderListReader>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    annexPdfGenerator = mock<AnnexPdfGenerator>();

    permissionChecker.assertAllowed.mockResolvedValue(undefined);
    stakeholderListRepository.findById.mockResolvedValue(requestedList);
    stakeholderListReader.listByProgramAndYear.mockResolvedValue([
      {
        list: requestedList,
        members: [
          StakeholderListMember.reconstitute({
            id: 'mem-1',
            listId: requestedList.id,
            stakeholderId: 'stk-1',
            fullName: 'Empresa Ficticia',
            institution: 'Empresa Ficticia SAC',
            ruc: '20123456789',
            sector: 'TI',
            representative: 'Juan Pérez',
            activity: null,
            email: 'contacto@empresa.test',
            mobile: '999111222',
            position: 'Gerente',
            graduationYear: null,
            cycle: null,
            createdBy: 'user-1',
            createdAt: NOW,
          }),
        ],
      },
      {
        list: teacherList,
        members: [
          StakeholderListMember.reconstitute({
            id: 'mem-2',
            listId: teacherList.id,
            stakeholderId: 'stk-2',
            fullName: 'Docente Ficticio',
            institution: null,
            ruc: null,
            sector: null,
            representative: null,
            activity: null,
            email: 'docente@untrm.test',
            mobile: '988111222',
            position: null,
            graduationYear: null,
            cycle: null,
            createdBy: 'user-1',
            createdAt: NOW,
          }),
        ],
      },
    ]);
    annexPdfGenerator.generate.mockResolvedValue({
      pdf: samplePdf,
      fileName: 'fo-03-2026-v1.pdf',
      templateCode: 'FO-03',
      versionNumber: 1,
    });

    useCase = new ExportStakeholderListPdfUseCase({
      stakeholderListRepository,
      stakeholderListReader,
      permissionChecker,
      annexPdfGenerator,
    });
  });

  it('renders the official annex 3 with the members of every list of the year', async () => {
    const result = await useCase.execute({
      actorId: 'user-1',
      ip: '127.0.0.1',
      listId: requestedList.id,
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'documento.descargar',
      scope: 'GLOBAL',
    });
    expect(stakeholderListReader.listByProgramAndYear).toHaveBeenCalledWith('prog-1', 2026);
    expect(annexPdfGenerator.generate).toHaveBeenCalledWith({
      actorId: 'user-1',
      ip: '127.0.0.1',
      annexCode: 'FO-03',
      fileLabel: '2026',
      data: expect.objectContaining({
        scalars: {
          'studyPlan.number': '2024',
          'studyPlan.year': '2026',
          'list.version': 'v1.0',
        },
        collections: expect.objectContaining({
          employers: [
            {
              institution: 'Empresa Ficticia SAC',
              ruc: '20123456789',
              sector: 'TI',
              legalRepresentative: 'Juan Pérez',
              email: 'contacto@empresa.test',
              phone: '999111222',
              position: 'Gerente',
            },
          ],
          teachers: [
            {
              name: 'Docente Ficticio',
              email: 'docente@untrm.test',
              contact: '988111222',
            },
          ],
        }),
      }),
      subject: {
        entity: 'StakeholderList',
        entityId: requestedList.id,
        metadata: {
          year: 2026,
          requestedType: 'EMPLOYER',
          listCount: 2,
          memberCount: 2,
        },
      },
    });
    expect(result).toEqual({
      pdf: samplePdf,
      fileName: 'fo-03-2026-v1.pdf',
      templateCode: 'FO-03',
      versionNumber: 1,
    });
  });

  it('denies the export without documento.descargar and never invokes the generator', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        actorId: 'user-sin-permiso',
        listId: requestedList.id,
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(stakeholderListRepository.findById).not.toHaveBeenCalled();
    expect(stakeholderListReader.listByProgramAndYear).not.toHaveBeenCalled();
    expect(annexPdfGenerator.generate).not.toHaveBeenCalled();
  });

  it('fails with not found when the list does not exist', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: 'user-1',
        listId: 'missing-list',
      }),
    ).rejects.toThrow(StakeholderListNotFoundError);

    expect(stakeholderListReader.listByProgramAndYear).not.toHaveBeenCalled();
    expect(annexPdfGenerator.generate).not.toHaveBeenCalled();
  });

  it('exports an empty annex 3 when the year lists have no members', async () => {
    stakeholderListReader.listByProgramAndYear.mockResolvedValueOnce([
      { list: requestedList, members: [] },
    ]);

    await useCase.execute({
      actorId: 'user-1',
      listId: requestedList.id,
    });

    expect(annexPdfGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          collections: {
            advisory: [],
            employers: [],
            graduates: [],
            students: [],
            teachers: [],
          },
        }),
        subject: expect.objectContaining({
          metadata: expect.objectContaining({
            listCount: 1,
            memberCount: 0,
          }),
        }),
      }),
    );
  });

  it('lets only one export per user run at the same time', async () => {
    const deferred = createDeferred<{
      pdf: Buffer;
      fileName: string;
      templateCode: string;
      versionNumber: number;
    }>();
    let active = false;
    annexPdfGenerator.generate.mockImplementation(async () => {
      if (active) {
        throw new ConflictError('Ya hay una descarga de anexo en curso para este usuario.');
      }
      active = true;
      try {
        return await deferred.promise;
      } finally {
        active = false;
      }
    });

    const firstPromise = useCase.execute({ actorId: 'user-1', listId: requestedList.id });
    await vi.waitFor(() => {
      expect(annexPdfGenerator.generate).toHaveBeenCalledTimes(1);
    });

    await expect(useCase.execute({ actorId: 'user-1', listId: requestedList.id })).rejects.toThrow(
      ConflictError,
    );

    deferred.resolve({
      pdf: samplePdf,
      fileName: 'fo-03-2026-v1.pdf',
      templateCode: 'FO-03',
      versionNumber: 1,
    });
    const first = await firstPromise;
    expect(first.pdf).toEqual(samplePdf);
  });
});
