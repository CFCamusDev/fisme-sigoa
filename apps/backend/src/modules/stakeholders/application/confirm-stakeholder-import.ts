import { randomUUID } from 'node:crypto';
import {
  confirmStakeholderImportResponseSchema,
  type ConfirmStakeholderImportResponse,
} from '@sigoa/shared';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { StakeholderListMember } from '../domain/entities/stakeholder-list-member.js';
import type { Stakeholder } from '../domain/entities/stakeholder.js';
import { NothingToImportError, StakeholderListNotFoundError } from '../domain/errors/index.js';
import { analyzeStakeholderImport } from '../domain/policies/analyze-stakeholder-import.js';
import type { StakeholderDocumentLookup } from '../domain/ports/stakeholder-document-lookup.js';
import type { StakeholderImportFileReader } from '../domain/ports/stakeholder-import-file-reader.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderRepository } from '../domain/ports/stakeholder-repository.js';
import type { ConfirmStakeholderImportCommand } from './confirm-stakeholder-import.types.js';
import {
  extractDocumentsForLookup,
  indexStakeholdersByDocument,
} from './preview-stakeholder-import.js';

export interface ConfirmStakeholderImportDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly stakeholderListMemberRepository: StakeholderListMemberRepository;
  readonly stakeholderRepository: StakeholderRepository;
  readonly stakeholderDocumentLookup: StakeholderDocumentLookup;
  readonly fileReader: StakeholderImportFileReader;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

/**
 * Relee y revalida un archivo Excel de constituyentes en el servidor y persiste
 * en una sola transacción los constituyentes nuevos, miembros de lista y la auditoría (HU-023, CA2).
 */
export class ConfirmStakeholderImportUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: ConfirmStakeholderImportDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(
    command: ConfirmStakeholderImportCommand,
  ): Promise<ConfirmStakeholderImportResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.importar',
      scope: 'GLOBAL',
    });

    const list = await this.deps.stakeholderListRepository.findById(command.listId);
    if (!list) {
      throw new StakeholderListNotFoundError();
    }

    const rawRows = await this.deps.fileReader.read(command.fileBuffer, list.type);
    const { dnis, rucs } = extractDocumentsForLookup(list.type, rawRows);
    const now = this.clock();

    return await this.deps.unitOfWork.run(async () => {
      const [existingStakeholders, existingMembers] = await Promise.all([
        this.deps.stakeholderDocumentLookup.findByDocuments({ dnis, rucs }),
        this.deps.stakeholderListMemberRepository.listByListId(list.id),
      ]);

      const analysis = analyzeStakeholderImport({
        listType: list.type,
        rows: rawRows,
        existingByDocument: indexStakeholdersByDocument(existingStakeholders),
        memberStakeholderIds: new Set(existingMembers.map((member) => member.stakeholderId)),
        idGenerator: this.idGenerator,
        actorId: command.actorId,
        now,
      });

      const newStakeholders: Stakeholder[] = [];
      const membersToAdd: StakeholderListMember[] = [];
      const rejectedRows: Array<{ rowNumber: number; errors: string[] }> = [];

      for (const row of analysis.rows) {
        if (row.status === 'INVALID') {
          rejectedRows.push({
            rowNumber: row.rowNumber,
            errors: [...row.errors],
          });
          continue;
        }
        if (row.status === 'NEW' && row.stakeholderToCreate) {
          newStakeholders.push(row.stakeholderToCreate);
        }
        if ((row.status === 'NEW' || row.status === 'EXISTING') && row.memberToAdd) {
          membersToAdd.push(
            StakeholderListMember.reconstitute({
              id: this.idGenerator(),
              listId: list.id,
              stakeholderId: row.memberToAdd.stakeholderId,
              ...row.memberToAdd.snapshot,
              createdBy: command.actorId,
              createdAt: now,
            }),
          );
        }
      }

      if (membersToAdd.length === 0) {
        throw new NothingToImportError();
      }

      await this.deps.stakeholderRepository.saveMany(newStakeholders);
      await this.deps.stakeholderListMemberRepository.addMany(membersToAdd);

      const importId = this.idGenerator();
      await this.deps.auditLogger.log({
        action: 'CREATE',
        entity: 'StakeholderListImport',
        entityId: importId,
        actor: command.actorId,
        ip: command.ip ?? undefined,
        before: null,
        after: {
          importId,
          listId: list.id,
          listType: list.type,
          totalRows: analysis.totals.total,
          created: newStakeholders.length,
          reused: analysis.totals.existing,
          added: membersToAdd.length,
          alreadyInList: analysis.totals.alreadyInList,
          rejected: rejectedRows.length,
          createdStakeholderIds: newStakeholders.map((stakeholder) => stakeholder.id),
        },
      });

      return confirmStakeholderImportResponseSchema.parse({
        importId,
        listId: list.id,
        totals: {
          created: newStakeholders.length,
          reused: analysis.totals.existing,
          added: membersToAdd.length,
          alreadyInList: analysis.totals.alreadyInList,
          rejected: rejectedRows.length,
        },
        rejectedRows,
      });
    });
  }
}
