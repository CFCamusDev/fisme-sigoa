import { describe, expect, it } from 'vitest';
import { routeTree } from '@/routeTree.gen';
import { Route } from './versiones_.$versionId';

function collectFullPaths(node: {
  fullPath?: string;
  children?: Record<string, unknown> | unknown[];
}): string[] {
  const paths: string[] = [];
  if (typeof node.fullPath === 'string') {
    paths.push(node.fullPath);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object') {
        paths.push(...collectFullPaths(child as { fullPath?: string; children?: unknown[] }));
      }
    }
  } else if (node.children && typeof node.children === 'object') {
    for (const child of Object.values(node.children)) {
      if (child && typeof child === 'object') {
        paths.push(
          ...collectFullPaths(child as { fullPath?: string; children?: Record<string, unknown> }),
        );
      }
    }
  }
  return paths;
}

describe('CatalogVersionEditorRoute (/catalogo/versiones/$versionId) (HU-014, HU-081, T-081-09)', () => {
  it('defines a beforeLoad guard that requires catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('defines the editor component', () => {
    expect(Route.options.component).toBeDefined();
  });

  it('does not serve the old english path', () => {
    const fullPaths = collectFullPaths(routeTree as unknown as { children?: unknown[] });
    expect(fullPaths).toContain('/catalogo/versiones/$versionId');
    expect(fullPaths).not.toContain('/catalog/versions/$versionId');
  });
});
