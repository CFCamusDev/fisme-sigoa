import type { ResourceOwnershipEvaluationInput } from '../domain/policies/evaluate-resource-access.js';
import type {
  ResourceOwnershipResolver,
  ResourceRef,
} from '../domain/ports/resource-ownership-resolver.js';

export class ResourceOwnershipRegistry {
  private readonly resolvers = new Map<string, ResourceOwnershipResolver>();

  public constructor(initialResolvers: readonly ResourceOwnershipResolver[] = []) {
    for (const resolver of initialResolvers) {
      this.register(resolver);
    }
  }

  public register(resolver: ResourceOwnershipResolver): void {
    if (this.resolvers.has(resolver.resourceType)) {
      throw new Error(
        `ResourceOwnershipResolver for resourceType "${resolver.resourceType}" is already registered.`,
      );
    }
    this.resolvers.set(resolver.resourceType, resolver);
  }

  public has(resourceType: string): boolean {
    return this.resolvers.has(resourceType);
  }

  public async resolve(
    actorId: string,
    resource: ResourceRef,
  ): Promise<ResourceOwnershipEvaluationInput> {
    const resolver = this.resolvers.get(resource.type);
    if (!resolver) {
      return 'UNKNOWN_RESOURCE_TYPE';
    }
    return resolver.resolveOwnership(actorId, resource.id);
  }
}
