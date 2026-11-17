import { randomUUID } from 'node:crypto';
import {
  previewStakeholderImportResponseSchema,
  type PreviewStakeholderImportResponse,
} from '@sigoa/shared';
import {
  STAKEHOLDER_DNI_PATTERN,
  STAKEHOLDER_RUC_PATTERN,
} from '../domain/entities/stakeholder-enums.js';
import type { Stakeholder } from '../domain/entities/stakeholder.js';
import { StakeholderListNotFoundError } from '../domain/errors/index.js';
import {
  analyzeStakeholderImport,
  normalizeImportDocument,
  type RawImportRow,
} from '../domain/policies/analyze-stakeholder-import.js';
import type { StakeholderListType } from '../domain/entities/stakeholder-list-enums.js';
import type { StakeholderDocumentLookup } from '../domain/ports/stakeholder-document-lookup.js';
import type { StakeholderImportFileReader } from '../domain/ports/stakeholder-import-file-reader.js';
import type { StakeholderListMemberRepository } from '../domain/ports/stakeholder-list-member-repository.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { PreviewStakeholderImportCommand } from './preview-stakeholder-import.types.js';

export interface PreviewStakeholderImportDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly stakeholderListMemberRepository: StakeholderListMemberRepository;
  readonly stakeholderDocumentLookup: StakeholderDocumentLookup;
  readonly fileReader: StakeholderImportFileReader;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly idGenerator?: () => string;
  readonly clock?: () => Date;
}

export function extractDocumentsForLookup(
  listType: StakeholderListType,
  rows: readonly RawImportRow[],
): { dnis: string[]; rucs: string[] } {
  const dnis = new Set<string>();
  const rucs = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeImportDocument(listType, row.values.document);
    if (normalized === null) {
      continue;
    }
    if (STAKEHOLDER_DNI_PATTERN.test(normalized)) {
      dnis.add(normalized);
    } else if (STAKEHOLDER_RUC_PATTERN.test(normalized)) {
      rucs.add(normalized);
    }
  }

  return { dnis: [...dnis], rucs: [...rucs] };
}

export function indexStakeholdersByDocument(
  stakeholders: readonly Stakeholder[],
): Map<string, Stakeholder> {
  const map = new Map<string, Stakeholder>();
  for (const stakeholder of stakeholders) {
    if (stakeholder.dni) {
      map.set(stakeholder.dni, stakeholder);
    }
    if (stakeholder.ruc) {
      map.set(stakeholder.ruc, stakeholder);
    }
  }
  return map;
}

/**
 * Lee un archivo Excel de constituyentes y devuelve la vista previa clasificada
 * sin escribir ni auditar cambios en la base de datos (HU-023, CA1, CA3, D2).
 */
export class PreviewStakeholderImportUseCase {
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;

  constructor(private readonly deps: PreviewStakeholderImportDependencies) {
    this.idGenerator = deps.idGenerator ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(
    command: PreviewStakeholderImportCommand,
  ): Promise<PreviewStakeholderImportResponse> {
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
      now: this.clock(),
    });

    return previewStakeholderImportResponseSchema.parse({
      listId: list.id,
      listType: list.type,
      totals: analysis.totals,
      rows: analysis.rows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        document: row.document,
        fullName: row.fullName,
        errors: [...row.errors],
      })),
    });
  }
}
