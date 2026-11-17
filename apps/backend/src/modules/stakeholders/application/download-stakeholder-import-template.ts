import type { StakeholderImportTemplateBuilder } from '../domain/ports/stakeholder-import-template-builder.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type {
  DownloadStakeholderImportTemplateCommand,
  DownloadStakeholderImportTemplateResult,
} from './download-stakeholder-import-template.types.js';

export interface DownloadStakeholderImportTemplateDependencies {
  readonly templateBuilder: StakeholderImportTemplateBuilder;
  readonly permissionChecker: StakeholderPermissionChecker;
}

/**
 * Genera la plantilla Excel descargable para un tipo de lista del Anexo 3.
 * No escribe ni audita porque es un archivo vacío sin datos personales (HU-023, D14).
 */
export class DownloadStakeholderImportTemplateUseCase {
  constructor(private readonly deps: DownloadStakeholderImportTemplateDependencies) {}

  async execute(
    command: DownloadStakeholderImportTemplateCommand,
  ): Promise<DownloadStakeholderImportTemplateResult> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'constituyente.importar',
      scope: 'GLOBAL',
    });

    const buffer = await this.deps.templateBuilder.build(command.type);

    return {
      fileName: `plantilla-${command.type.toLowerCase()}.xlsx`,
      buffer,
    };
  }
}
