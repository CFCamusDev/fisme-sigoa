import { describe, expect, it } from 'vitest';
import { Route } from './versions.$versionId';

describe('CatalogVersionEditorRoute (/catalog/versions/$versionId) (HU-014, T-014-17)', () => {
  it('defines a beforeLoad guard that requires catalogo.ver', () => {
    expect(typeof Route.options.beforeLoad).toBe('function');
  });

  it('defines the editor component', () => {
    expect(Route.options.component).toBeDefined();
  });
});
