export interface SaveGraduateAttributeCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly versionId: string;
  /** Sin `id` es un alta; con `id`, una edición. */
  readonly id?: string;
  readonly code: string;
  readonly name: string;
  readonly statement: string;
}
