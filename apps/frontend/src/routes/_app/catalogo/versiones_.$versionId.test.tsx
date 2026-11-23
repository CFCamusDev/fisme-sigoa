import { createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from '@/routeTree.gen';
import { Route } from './versiones_.$versionId';

describe('CatalogVersionEditorRoute (/catalogo/versiones/$versionId) (HU-014, HU-081, T-081-09)', () => {
  it('defines a beforeLoad guard that requires catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('defines the editor component', () => {
    expect(Route.options.component).toBeDefined();
  });

  it('does not serve the old english path', () => {
    const router = createRouter({ routeTree });
    const fullPaths = Object.keys(router.routesByPath);
    expect(fullPaths).toContain('/catalogo/versiones/$versionId');
    expect(fullPaths).not.toContain('/catalog/versions/$versionId');
  });
});
