export interface ActivateCatalogVersionCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly versionId: string;
  /** Resolución aprobada que activa la versión; queda en la auditoría. */
  readonly resolutionId: string;
}
