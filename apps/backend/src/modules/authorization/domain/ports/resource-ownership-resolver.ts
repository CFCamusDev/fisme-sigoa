export type ResourceOwnershipStatus = 'OWNER' | 'NOT_OWNER' | 'NOT_FOUND';

export interface ResourceRef {
  readonly type: string;
  readonly id: string;
}

export interface ResourceOwnershipResolver {
  readonly resourceType: string;
  resolveOwnership(actorId: string, resourceId: string): Promise<ResourceOwnershipStatus>;
}
