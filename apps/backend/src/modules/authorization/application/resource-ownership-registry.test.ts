import { describe, expect, it, vi } from 'vitest';
import type { ResourceOwnershipResolver } from '../domain/ports/resource-ownership-resolver.js';
import { ResourceOwnershipRegistry } from './resource-ownership-registry.js';

describe('ResourceOwnershipRegistry (RS-011, RF-008, D5)', () => {
  it('returns UNKNOWN_RESOURCE_TYPE when no resolver is registered for the resource type', async () => {
    const registry = new ResourceOwnershipRegistry();

    const result = await registry.resolve('actor-1', {
      type: 'CourseMeasurement',
      id: 'cm-100',
    });

    expect(result).toBe('UNKNOWN_RESOURCE_TYPE');
  });

  it('delegates to the registered resolver for the matching resourceType', async () => {
    const resolver: ResourceOwnershipResolver = {
      resourceType: 'CourseMeasurement',
      resolveOwnership: vi.fn().mockResolvedValue('OWNER'),
    };
    const registry = new ResourceOwnershipRegistry([resolver]);

    const result = await registry.resolve('teacher-1', {
      type: 'CourseMeasurement',
      id: 'cm-200',
    });

    expect(result).toBe('OWNER');
    expect(resolver.resolveOwnership).toHaveBeenCalledWith('teacher-1', 'cm-200');
  });

  it('allows registering new resolvers dynamically via register()', async () => {
    const registry = new ResourceOwnershipRegistry();
    const resolver: ResourceOwnershipResolver = {
      resourceType: 'CourseOffering',
      resolveOwnership: vi.fn().mockResolvedValue('NOT_OWNER'),
    };

    registry.register(resolver);

    const result = await registry.resolve('teacher-2', {
      type: 'CourseOffering',
      id: 'co-300',
    });

    expect(result).toBe('NOT_OWNER');
    expect(registry.has('CourseOffering')).toBe(true);
    expect(registry.has('UnknownType')).toBe(false);
  });

  it('rejects registering a duplicate resolver for the same resourceType', () => {
    const resolverA: ResourceOwnershipResolver = {
      resourceType: 'CourseMeasurement',
      resolveOwnership: vi.fn(),
    };
    const resolverB: ResourceOwnershipResolver = {
      resourceType: 'CourseMeasurement',
      resolveOwnership: vi.fn(),
    };

    const registry = new ResourceOwnershipRegistry([resolverA]);
    expect(() => registry.register(resolverB)).toThrow(/CourseMeasurement/);
  });
});
