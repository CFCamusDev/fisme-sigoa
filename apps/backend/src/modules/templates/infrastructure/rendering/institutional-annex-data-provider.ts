import { OFFICIAL_LOGO_DATA_URI } from '../../../../shared/branding/official-logo-data-uri.js';
import type { TemplateRenderData } from '../../domain/policies/template-renderer.js';
import type {
  AnnexDataProvider,
  AnnexDataProviderInput,
} from '../../domain/ports/annex-data-provider.js';

/**
 * Proveedor institucional base para los anexos oficiales (D2, D4):
 * entrega el escudo oficial embebido como data URI para todos los anexos.
 */
export class InstitutionalAnnexDataProvider implements AnnexDataProvider {
  public supports(_annexCode: string): boolean {
    return true;
  }

  public async provide(_input: AnnexDataProviderInput): Promise<Partial<TemplateRenderData>> {
    return {
      scalars: {
        'logo.url': OFFICIAL_LOGO_DATA_URI,
      },
    };
  }
}
