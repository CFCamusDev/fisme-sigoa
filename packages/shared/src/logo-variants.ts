export const LOGO_VARIANT_NAMES = ['icon', 'square', 'horizontal'] as const;
export type LogoVariant = (typeof LOGO_VARIANT_NAMES)[number];

export const LOGO_ASSETS_PATH = '/assets';
export const LOGO_ALT_TEXT = 'Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas';

export interface LogoVariantInfo {
  file: string;
  size: number;
}

export const LOGO_VARIANTS: Record<LogoVariant, LogoVariantInfo> = {
  icon: { file: 'logo-untrm-v1-64.png', size: 64 },
  square: { file: 'logo-untrm-v1-256.png', size: 256 },
  horizontal: { file: 'logo-untrm-v1-256.png', size: 256 }, // mismo escudo; el nombre va en texto
};
