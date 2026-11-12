import type { PermissionScope } from '../policies/effective-permissions.js';

export type AccessDenialReason =
  | 'MISSING_PERMISSION'
  | 'SCOPE_INSUFFICIENT'
  | 'NOT_OWNER'
  | 'UNKNOWN_PERMISSION'
  | 'UNKNOWN_RESOURCE_TYPE';

export interface AccessDenial {
  readonly actorId: string;
  readonly permission: string;
  readonly requiredScope: PermissionScope;
  readonly grantedScope: PermissionScope | null;
  readonly reason: AccessDenialReason;
  readonly method?: string;
  readonly route?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

export interface AccessDenialRecorder {
  record(denial: AccessDenial): Promise<void>;
}
