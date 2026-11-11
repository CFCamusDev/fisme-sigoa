import { responseScalesResponseSchema, type ResponseScalesResponse } from '@sigoa/shared';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ScaleUsageReader } from '../domain/ports/scale-usage-reader.js';
import type { ListResponseScalesQuery } from './list-response-scales.types.js';
import { mapResponseScaleToDto } from './response-scale-dto.js';

export interface ListResponseScalesDependencies {
  readonly scaleReader: ResponseScaleReader;
  readonly scaleUsageReader: ScaleUsageReader;
  readonly permissionChecker: ParametersPermissionChecker;
}

/**
 * Lista las escalas con sus niveles y si están en uso (HU-012, RF-012, CA1, CA2).
 * Es una lectura: sin transacción ni auditoría (D29).
 */
export class ListResponseScalesUseCase {
  constructor(private readonly deps: ListResponseScalesDependencies) {}

  async execute(query: ListResponseScalesQuery): Promise<ResponseScalesResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });

    const scales = await this.deps.scaleReader.list(query.type ? { type: query.type } : undefined);
    const items = await Promise.all(
      scales.map(async (scale) =>
        mapResponseScaleToDto(scale, await this.deps.scaleUsageReader.isInUse(scale.id)),
      ),
    );

    return responseScalesResponseSchema.parse({ items });
  }
}
