import type { TemplateVariable } from '@sigoa/shared';
import type { TemplateRenderData } from './template-renderer.js';

const SAMPLE_COLLECTION_SIZE = 3;

const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" viewBox="0 0 96 48"><rect width="96" height="48" rx="4" fill="#e2e8f0" stroke="#94a3b8"/><text x="48" y="28" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">Escudo</text></svg>';

export const SAMPLE_PLACEHOLDER_IMAGE = `data:image/svg+xml;base64,${Buffer.from(PLACEHOLDER_SVG, 'utf8').toString('base64')}`;

const DATA_REPEAT_PATTERN = /\bdata-repeat\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const SRC_VARIABLE_PATTERN =
  /\bsrc\s*=\s*(?:"\{\{([^{}]+)\}\}"|'\{\{([^{}]+)\}\}'|\{\{([^{}]+)\}\})/gi;

function extractCollectionNames(content: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const match of content.matchAll(DATA_REPEAT_PATTERN)) {
    const name = (match[1] ?? match[2] ?? '').trim();
    if (name !== '' && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

function extractSrcVariableKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const match of content.matchAll(SRC_VARIABLE_PATTERN)) {
    const key = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (key !== '') {
      keys.add(key);
    }
  }
  return keys;
}

/**
 * Construye datos ficticios de ejemplo para la vista previa de una plantilla (HU-019, D5):
 * 3 elementos por colección `data-repeat` y un marcador neutro para variables usadas en `src`.
 */
export function buildTemplateSampleData(
  content: string,
  variables: readonly TemplateVariable[],
): TemplateRenderData {
  const collectionNames = extractCollectionNames(content);
  const srcKeys = extractSrcVariableKeys(content);

  const scalars: Record<string, string> = {};
  const collections: Record<string, Record<string, string>[]> = {};

  for (const collection of collectionNames) {
    collections[collection] = Array.from({ length: SAMPLE_COLLECTION_SIZE }, () => ({}));
  }

  for (const variable of variables) {
    const matchingCollection = collectionNames.find((name) => variable.key.startsWith(`${name}.`));

    if (matchingCollection) {
      const field = variable.key.slice(matchingCollection.length + 1);
      const items = collections[matchingCollection]!;
      items.forEach((item, index) => {
        item[field] = srcKeys.has(variable.key)
          ? SAMPLE_PLACEHOLDER_IMAGE
          : `${variable.label} (ejemplo ${index + 1})`;
      });
    } else {
      scalars[variable.key] = srcKeys.has(variable.key)
        ? SAMPLE_PLACEHOLDER_IMAGE
        : `${variable.label} (ejemplo)`;
    }
  }

  return { scalars, collections };
}
