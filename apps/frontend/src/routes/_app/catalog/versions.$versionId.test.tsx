import { describe, expect, it } from 'vitest';
import { Route } from './versions.$versionId';

describe('CatalogVersionEditorRoute (/catalog/versions/$versionId) (HU-014, T-014-17)', () => {
  it('defines a beforeLoad guard and a component', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
    expect(Route.options.component).toBeDefined();
  });

  it('is mounted under the catalog path with the version id parameter', () => {
    expect(Route.fullPath).toBe('/catalog/versions/$versionId');
  });
});
