import { STAKEHOLDER_LIST_PDF_ANNEX_CODE } from '@sigoa/shared';
import { StakeholderListNotFoundError } from '../domain/errors/stakeholder-list-not-found-error.js';
import { buildAnnex3RenderData } from '../domain/policies/build-annex3-render-data.js';
import type { AnnexPdfGenerator } from '../domain/ports/annex-pdf-generator.js';
import type { StakeholderListReader } from '../domain/ports/stakeholder-list-reader.js';
import type { StakeholderListRepository } from '../domain/ports/stakeholder-list-repository.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type {
  ExportStakeholderListPdfCommand,
  ExportStakeholderListPdfResult,
} from './export-stakeholder-list-pdf.types.js';

export interface ExportStakeholderListPdfDependencies {
  readonly stakeholderListRepository: StakeholderListRepository;
  readonly stakeholderListReader: StakeholderListReader;
  readonly permissionChecker: StakeholderPermissionChecker;
  readonly annexPdfGenerator: AnnexPdfGenerator;
}

/**
 * Exporta el Anexo 3 (FO-03) en PDF consolidado para el programa y año de la lista solicitada (HU-026).
 * Delega la renderización oficial y la auditoría `DOWNLOAD` al puerto `AnnexPdfGenerator`.
 */
export class ExportStakeholderListPdfUseCase {
  constructor(private readonly deps: ExportStakeholderListPdfDependencies) {}

  async execute(command: ExportStakeholderListPdfCommand): Promise<ExportStakeholderListPdfResult> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'documento.descargar',
      scope: 'GLOBAL',
    });

    const list = await this.deps.stakeholderListRepository.findById(command.listId);
    if (!list) {
      throw new StakeholderListNotFoundError();
    }

    const listsOfYear = await this.deps.stakeholderListReader.listByProgramAndYear(
      list.programId,
      list.year,
    );
    const data = buildAnnex3RenderData(list, listsOfYear);
    const memberCount = listsOfYear.reduce((total, entry) => total + entry.members.length, 0);

    return this.deps.annexPdfGenerator.generate({
      actorId: command.actorId,
      ip: command.ip,
      annexCode: STAKEHOLDER_LIST_PDF_ANNEX_CODE,
      data,
      fileLabel: String(list.year),
      subject: {
        entity: 'StakeholderList',
        entityId: list.id,
        metadata: {
          year: list.year,
          requestedType: list.type,
          listCount: listsOfYear.length,
          memberCount,
        },
      },
    });
  }
}
