import type { ActivateCatalogVersionUseCase } from '../../application/activate-catalog-version.js';

/** Forma estructural del evento `ResolutionApproved`; `catalog` no importa el módulo `resolutions`. */
export interface CatalogResolutionApprovedEvent {
  readonly resolutionId: string;
  readonly type: string;
  readonly catalogVersionId: string | null;
  readonly approvedBy: string;
}

const ACTIVATING_TYPES: ReadonlySet<string> = new Set([
  'EDUCATIONAL_OBJECTIVE',
  'GRADUATE_ATTRIBUTE',
]);

/**
 * Suscriptor de `ResolutionApproved` (HU-016, RN-064): las resoluciones de OE y AG con versión
 * activan esa versión dentro de la transacción de la aprobación; el resto se ignora (D6).
 */
export function createCatalogResolutionApprovedSubscriber(
  useCase: Pick<ActivateCatalogVersionUseCase, 'execute'>,
): (event: CatalogResolutionApprovedEvent) => Promise<void> {
  return async (event) => {
    if (!ACTIVATING_TYPES.has(event.type) || event.catalogVersionId === null) {
      return;
    }
    await useCase.execute({
      actorId: event.approvedBy,
      versionId: event.catalogVersionId,
      resolutionId: event.resolutionId,
    });
  };
}
