import { z } from 'zod';

export function setupZodLocale(): void {
  if (z.locales && typeof z.locales.es === 'function') {
    z.config(z.locales.es());
  }
}
