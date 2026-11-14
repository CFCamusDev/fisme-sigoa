import type { TemplateDetailDto } from '@sigoa/shared';
import { TemplateNotFoundError } from '../domain/errors/index.js';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { GetTemplateDetailCommand } from './list-templates.types.js';
import { toTemplateDetailDto } from './template-dto.js';

export interface GetTemplateDetailDependencies {
  readonly templateReader: TemplateReader;
  readonly versionReader: TemplateVersionReader;
  readonly permissionChecker: TemplatePermissionChecker;
}

/** Detalle de una plantilla para el editor: historial y contenido vigente (HU-018). No audita. */
export class GetTemplateDetailUseCase {
  constructor(private readonly deps: GetTemplateDetailDependencies) {}

  async execute(command: GetTemplateDetailCommand): Promise<TemplateDetailDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'plantilla.ver',
      scope: 'GLOBAL',
    });

    const template = await this.deps.templateReader.findById(command.templateId);
    if (!template) {
      throw new TemplateNotFoundError();
    }
    const versions = await this.deps.versionReader.listByTemplate(template.id);
    return toTemplateDetailDto(template, versions);
  }
}
