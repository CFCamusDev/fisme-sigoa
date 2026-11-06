import { describe, expect, it } from 'vitest';
import { Route } from './activar.$token';

describe('activar.$token route (HU-004, T-004-16)', () => {
  it('defines the route without beforeLoad redirect guards', () => {
    // La ruta pública de activación no tiene beforeLoad restrictivo
    expect(Route.options.beforeLoad).toBeUndefined();
  });

  it('declares component on route options', () => {
    expect(Route.options.component).toBeDefined();
    expect(typeof Route.options.component).toBe('function');
  });
});
