import type { ResolutionType } from './resolution-enums.js';

/**
 * Evento de dominio: una resolución pasó a Aprobada. HU-016 lo consume para activar la versión
 * del catálogo (RN-064); el módulo `resolutions` no conoce a sus suscriptores.
 */
export interface ResolutionApproved {
  readonly resolutionId: string;
  readonly type: ResolutionType;
  readonly catalogVersionId: string | null;
  readonly approvedBy: string;
  readonly approvedAt: Date;
}
