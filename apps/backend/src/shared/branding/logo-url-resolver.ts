import { LOGO_ASSETS_PATH, type LogoVariant, LOGO_VARIANTS } from '@sigoa/shared';

export class LogoUrlResolver {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  resolve(variant: LogoVariant): string {
    const file = LOGO_VARIANTS[variant].file;
    return `${this.baseUrl}${LOGO_ASSETS_PATH}/${file}`;
  }
}
