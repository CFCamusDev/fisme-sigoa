import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import { DuplicateStakeholderError, NothingToImportError } from '../domain/errors/index.js';
import type { StakeholderDocumentLookup } from '../domain/ports/stakeholder-document-lookup.js';
import type { StakeholderImportFileReader } from '../domain/ports/stakeholder-import-file-reader.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import { ConfirmStakeholderImportUseCase } from './confirm-stakeholder-import.js';

const NOW = new Date('2026-11-17T12:00:00.000Z');

describe('ConfirmStakeholderImportUseCase (HU-023, T-023-03, T-023-14)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let stakeholderListMemberRepository: MockProxy<StakeholderListMemberRepository>;
  let stakeholderRepository: MockProxy<StakeholderRepository>;
  let stakeholderDocumentLookup: MockProxy<StakeholderDocumentLookup>;
  let fileReader: MockProxy<StakeholderImportFileReader>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let unitOfWork: MockProxy<UnitOfWork>;
  let auditLogger: MockProxy<AuditLogger>;
  let useCase: ConfirmStakeholderImportUseCase;
  let seq: number;

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    stakeholderListMemberRepository = mock<StakeholderListMemberRepository>();
    stakeholderRepository = mock<StakeholderRepository>();
    stakeholderDocumentLookup = mock<StakeholderDocumentLookup>();
    fileReader = mock<StakeholderImportFileReader>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    unitOfWork = mock<UnitOfWork>();
    auditLogger = mock<AuditLogger>();
    unitOfWork.run.mockImplementation(async (work) => work());
    seq = 0;

    useCase = new ConfirmStakeholderImportUseCase({
      stakeholderListRepository,
      stakeholderListMemberRepository,
      stakeholderRepository,
      stakeholderDocumentLookup,
      fileReader,
      permissionChecker,
      unitOfWork,
      auditLogger,
      idGenerator: () => {
        seq += 1;
        return `id-${seq}`;
      },
      clock: () => NOW,
    });
  });

  it('reuses the existing stakeholder and creates only the list member', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const existing = Stakeholder.register({
      id: 'stk-existing',
      kind: 'PERSON',
      fullName: 'Rosa Diaz Paredes',
      dni: '45678912',
      email: 'rosa.diaz@example.com',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '45678912',
          fullName: 'Otro Nombre',
          email: 'otro@example.com',
          mobile: '911111111',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([existing]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    const result = await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
      ip: '127.0.0.1',
    });

    expect(result.totals).toEqual({
      created: 0,
      reused: 1,
      added: 1,
      alreadyInList: 0,
      rejected: 0,
    });
    expect(stakeholderRepository.saveMany).toHaveBeenCalledWith([]);
    expect(stakeholderListMemberRepository.addMany).toHaveBeenCalledTimes(1);
    const addedMembers = stakeholderListMemberRepository.addMany.mock.calls[0]?.[0] ?? [];
    expect(addedMembers).toHaveLength(1);
    expect(addedMembers[0]?.stakeholderId).toBe('stk-existing');
    expect(addedMembers[0]?.fullName).toBe('Rosa Diaz Paredes');
  });

  it('creates new stakeholders and members in one transaction', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '71234567',
          fullName: 'Mario Quispe Salas',
          email: 'mario@example.com',
          mobile: '912345678',
        },
      },
      {
        rowNumber: 3,
        values: {
          document: '123',
          fullName: 'Invalido',
          email: 'bad@example.com',
          mobile: '912345679',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    const result = await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
    });

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(result.totals).toEqual({
      created: 1,
      reused: 0,
      added: 1,
      alreadyInList: 0,
      rejected: 1,
    });
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0]?.rowNumber).toBe(3);
  });

  it('audits one summary without personal data', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '71234567',
          fullName: 'Mario Quispe Salas',
          email: 'mario.privado@example.com',
          mobile: '912345678',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
      ip: '10.0.0.2',
    });

    expect(auditLogger.log).toHaveBeenCalledTimes(1);
    const auditPayload = auditLogger.log.mock.calls[0]?.[0];
    expect(auditPayload?.action).toBe('CREATE');
    expect(auditPayload?.entity).toBe('StakeholderListImport');
    const serialized = JSON.stringify(auditPayload?.after);
    expect(serialized).not.toContain('mario.privado@example.com');
    expect(serialized).not.toContain('912345678');
    expect(serialized).not.toContain('Mario Quispe Salas');
  });

  it('fails with nothing to import when no row is valid', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '123',
          fullName: 'Invalido',
          email: 'bad@example.com',
          mobile: '912345678',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        listId: 'list-1',
        fileBuffer: Buffer.from('PK\x03\x04dummy'),
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(NothingToImportError);

    expect(stakeholderRepository.saveMany).not.toHaveBeenCalled();
    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('maps a uniqueness violation to a conflict and audits nothing', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '71234567',
          fullName: 'Mario Quispe Salas',
          email: 'mario@example.com',
          mobile: '912345678',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);
    stakeholderRepository.saveMany.mockRejectedValueOnce(new DuplicateStakeholderError());

    await expect(
      useCase.execute({
        listId: 'list-1',
        fileBuffer: Buffer.from('PK\x03\x04dummy'),
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(DuplicateStakeholderError);

    expect(auditLogger.log).not.toHaveBeenCalled();
  });

  it('denies access without the import permission', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Acceso denegado'));

    await expect(
      useCase.execute({
        listId: 'list-1',
        fileBuffer: Buffer.from('PK\x03\x04dummy'),
        actorId: 'user-sin-permiso',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(fileReader.read).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it('reads the file before opening the transaction', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    const callOrder: string[] = [];
    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockImplementationOnce(async () => {
      callOrder.push('read');
      return [
        {
          rowNumber: 2,
          values: {
            document: '71234567',
            fullName: 'Mario Quispe Salas',
            email: 'mario@example.com',
            mobile: '912345678',
          },
        },
      ];
    });
    unitOfWork.run.mockImplementationOnce(async (work) => {
      callOrder.push('uow');
      return work();
    });
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
    });

    expect(callOrder).toEqual(['read', 'uow']);
  });

  it('returns every error of a rejected row with invalid RUC, email and mobile', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '123',
          fullName: 'Empresa Mal',
          sector: 'Tecnologia',
          position: 'Gerente',
          representative: 'Ana',
          email: 'correo-malo',
          mobile: '12345',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    const result = await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
    });

    expect(result.totals.rejected).toBe(1);
    expect(result.rejectedRows[0]?.errors).toEqual(
      expect.arrayContaining([
        'El RUC debe tener exactamente 11 dígitos numéricos.',
        'El correo electrónico no tiene un formato válido.',
        'El celular debe tener 9 dígitos e iniciar con 9.',
      ]),
    );
  });
});
