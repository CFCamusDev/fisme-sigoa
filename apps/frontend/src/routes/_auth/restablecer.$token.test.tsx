import { describe, expect, it } from 'vitest';
import { Route } from './restablecer.$token';

describe('restablecer.$token route (HU-005, T-005-11, D5)', () => {
  it('defines the route without beforeLoad redirect guards', () => {
    // La ruta pública de restablecimiento no tiene beforeLoad restrictivo (D5)
    expect(Route.options.beforeLoad).toBeUndefined();
  });

  it('declares component on route options', () => {
    expect(Route.options.component).toBeDefined();
    expect(typeof Route.options.component).toBe('function');
  });
});
