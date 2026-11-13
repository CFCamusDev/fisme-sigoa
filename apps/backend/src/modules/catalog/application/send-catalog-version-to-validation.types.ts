export interface SendCatalogVersionToValidationCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly versionId: string;
}
