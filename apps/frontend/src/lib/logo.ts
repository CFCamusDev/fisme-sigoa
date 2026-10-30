import { LOGO_ASSETS_PATH, type LogoVariant, LOGO_VARIANTS } from '@sigoa/shared';

export function getLogoUrl(variant: LogoVariant): string {
  const file = LOGO_VARIANTS[variant].file;
  return `${LOGO_ASSETS_PATH}/${file}`;
}
