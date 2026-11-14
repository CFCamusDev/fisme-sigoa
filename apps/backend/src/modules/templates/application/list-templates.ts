import { listTemplatesResponseSchema, type ListTemplatesResponse } from '@sigoa/shared';
import type { TemplatePermissionChecker } from '../domain/ports/template-permission-checker.js';
import type { TemplateReader } from '../domain/ports/template-reader.js';
import type { TemplateVersionReader } from '../domain/ports/template-version-reader.js';
import type { ListTemplatesCommand } from './list-templates.types.js';
import { toTemplateSummaryDto } from './template-dto.js';

export interface ListTemplatesDependencies {
  readonly templateReader: TemplateReader;
  readonly versionReader: TemplateVersionReader;
  readonly permissionChecker: TemplatePermissionChecker;
}

/** Lista paginada de plantillas con su versión Publicada y su Borrador (HU-018). Lectura: no audita. */
export class ListTemplatesUseCase {
  constructor(private readonly deps: ListTemplatesDependencies) {}

  async execute(command: ListTemplatesCommand): Promise<ListTemplatesResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'plantilla.ver',
      scope: 'GLOBAL',
    });

    const { items, total } = await this.deps.templateReader.list({
      ...(command.type ? { type: command.type } : {}),
      page: command.page,
      pageSize: command.pageSize,
    });
    // Una sola consulta para las versiones vigentes de toda la página (sin N+1).
    const current = await this.deps.versionReader.findCurrentByTemplateIds(
      items.map((template) => template.id),
    );

    // Se valida contra el contrato antes de responder (B3).
    return listTemplatesResponseSchema.parse({
      items: items.map((template) => {
        const versions = current.get(template.id);
        return toTemplateSummaryDto(template, versions?.published ?? null, versions?.draft ?? null);
      }),
      page: command.page,
      pageSize: command.pageSize,
      total,
      totalPages: Math.ceil(total / command.pageSize),
    });
  }
}
