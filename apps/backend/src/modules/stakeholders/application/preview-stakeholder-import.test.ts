import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { StakeholderList } from '../domain/entities/stakeholder-list.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import { Stakeholder } from '../domain/entities/stakeholder.js';
import { StakeholderListNotFoundError } from '../domain/errors/index.js';
import type { StakeholderDocumentLookup } from '../domain/ports/stakeholder-document-lookup.js';
import type { StakeholderImportFileReader } from '../domain/ports/stakeholder-import-file-reader.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { PreviewStakeholderImportUseCase } from './preview-stakeholder-import.js';

const NOW = new Date('2026-11-17T12:00:00.000Z');

describe('PreviewStakeholderImportUseCase (HU-023, T-023-02, T-023-13)', () => {
  let stakeholderListRepository: MockProxy<StakeholderListRepository>;
  let stakeholderListMemberRepository: MockProxy<StakeholderListMemberRepository>;
  let stakeholderDocumentLookup: MockProxy<StakeholderDocumentLookup>;
  let fileReader: MockProxy<StakeholderImportFileReader>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let useCase: PreviewStakeholderImportUseCase;

  beforeEach(() => {
    stakeholderListRepository = mock<StakeholderListRepository>();
    stakeholderListMemberRepository = mock<StakeholderListMemberRepository>();
    stakeholderDocumentLookup = mock<StakeholderDocumentLookup>();
    fileReader = mock<StakeholderImportFileReader>();
    permissionChecker = mock<StakeholderPermissionChecker>();

    useCase = new PreviewStakeholderImportUseCase({
      stakeholderListRepository,
      stakeholderListMemberRepository,
      stakeholderDocumentLookup,
      fileReader,
      permissionChecker,
      idGenerator: () => 'gen-1',
      clock: () => NOW,
    });
  });

  it('returns the preview with valid rows and row errors without writing', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const existingTeacher = Stakeholder.register({
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
          document: '71234567',
          fullName: 'Mario Quispe Salas',
          email: 'mario.quispe@example.com',
          mobile: '912345678',
        },
      },
      {
        rowNumber: 3,
        values: {
          document: '45678912',
          fullName: 'Rosa Diaz Paredes',
          email: 'rosa.diaz@example.com',
          mobile: '987654321',
        },
      },
      {
        rowNumber: 4,
        values: {
          document: '123',
          fullName: 'Fila Invalida',
          email: 'bad@example.com',
          mobile: '912345679',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([existingTeacher]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    const result = await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
    });

    expect(result.listId).toBe('list-1');
    expect(result.listType).toBe('TEACHER');
    expect(result.totals).toEqual({
      total: 3,
      new: 1,
      existing: 1,
      alreadyInList: 0,
      invalid: 1,
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.status).toBe('NEW');
    expect(result.rows[1]?.status).toBe('EXISTING');
    expect(result.rows[2]?.status).toBe('INVALID');
  });

  it('never writes or audits', async () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });
    const memberStakeholder = Stakeholder.register({
      id: 'stk-member',
      kind: 'PERSON',
      fullName: 'Ana Torres',
      dni: '71234567',
      email: 'ana@example.com',
      mobile: '912345678',
      actorId: 'user-1',
      now: NOW,
    });
    const existingMember = StakeholderListMember.create({
      id: 'mem-1',
      list,
      stakeholder: memberStakeholder,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([
      {
        rowNumber: 2,
        values: {
          document: '71234567',
          fullName: 'Ana Torres',
          email: 'ana@example.com',
          mobile: '912345678',
        },
      },
    ]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([memberStakeholder]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([existingMember]);

    const result = await useCase.execute({
      listId: 'list-1',
      fileBuffer: Buffer.from('PK\x03\x04dummy'),
      actorId: 'user-1',
    });

    expect(result.totals.alreadyInList).toBe(1);
    expect(stakeholderListMemberRepository.add).not.toHaveBeenCalled();
    expect(stakeholderListMemberRepository.addMany).not.toHaveBeenCalled();
    expect(stakeholderListRepository.save).not.toHaveBeenCalled();
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

    expect(stakeholderListRepository.findById).not.toHaveBeenCalled();
    expect(fileReader.read).not.toHaveBeenCalled();
  });

  it('fails with not found when the list does not exist', async () => {
    stakeholderListRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        listId: 'missing-list',
        fileBuffer: Buffer.from('PK\x03\x04dummy'),
        actorId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(StakeholderListNotFoundError);

    expect(fileReader.read).not.toHaveBeenCalled();
  });

  it('parses the response before returning', async () => {
    const list = StakeholderList.create({
      id: '',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    stakeholderListRepository.findById.mockResolvedValueOnce(list);
    fileReader.read.mockResolvedValueOnce([]);
    stakeholderDocumentLookup.findByDocuments.mockResolvedValueOnce([]);
    stakeholderListMemberRepository.listByListId.mockResolvedValueOnce([]);

    await expect(
      useCase.execute({
        listId: '',
        fileBuffer: Buffer.from('PK\x03\x04dummy'),
        actorId: 'user-1',
      }),
    ).rejects.toThrow();
  });
});
