export interface PublishTemplateCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly templateId: string;
  /** Borrador que el administrador revisó. */
  readonly versionId: string;
  /** `updatedAt` (ISO) del Borrador cuando lo revisó; si cambió, se rechaza con 409. */
  readonly expectedUpdatedAt: string;
}
