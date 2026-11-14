import { listResolutionsResponseSchema, type ListResolutionsResponse } from '@sigoa/shared';
import type { ResolutionPermissionChecker } from '../domain/ports/resolution-permission-checker.js';
import type { ResolutionReader } from '../domain/ports/resolution-reader.js';
import type { ListResolutionsCommand } from './list-resolutions.types.js';
import { mapResolutionToDto } from './resolution-dto.js';

export interface ListResolutionsDependencies {
  readonly resolutionReader: ResolutionReader;
  readonly permissionChecker: ResolutionPermissionChecker;
}

/** Lista paginada de resoluciones con filtros (HU-048, RF-048). Lectura: no audita. */
export class ListResolutionsUseCase {
  constructor(private readonly deps: ListResolutionsDependencies) {}

  async execute(command: ListResolutionsCommand): Promise<ListResolutionsResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: command.actorId,
      permission: 'resolucion.ver',
      scope: 'GLOBAL',
    });

    const { items, total } = await this.deps.resolutionReader.list({
      ...(command.type ? { type: command.type } : {}),
      ...(command.status ? { status: command.status } : {}),
      ...(command.catalogVersionId ? { catalogVersionId: command.catalogVersionId } : {}),
      page: command.page,
      pageSize: command.pageSize,
    });

    // Se valida contra el contrato antes de responder (B3).
    return listResolutionsResponseSchema.parse({
      items: items.map(mapResolutionToDto),
      page: command.page,
      pageSize: command.pageSize,
      total,
      totalPages: Math.ceil(total / command.pageSize),
    });
  }
}
