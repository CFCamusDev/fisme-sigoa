import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';

export interface TemplateRenderData {
  readonly scalars: Readonly<Record<string, string>>;
  readonly collections: Readonly<Record<string, readonly Readonly<Record<string, string>>[]>>;
}

const DATA_REPEAT_OPEN_TAG_PATTERN =
  /<([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*\bdata-repeat\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*)>/i;
const DATA_REPEAT_ATTR_PATTERN = /\s+data-repeat\s*=\s*(?:"[^"]*"|'[^']*')/i;
const SCALAR_PLACEHOLDER_PATTERN = /\{\{([^{}]+)\}\}/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findClosingTagRange(
  content: string,
  tagName: string,
  collectionName: string,
  searchFrom: number,
): { closeStart: number; closeEnd: number } {
  const tagMatcher = new RegExp(`<(/?)${escapeRegExp(tagName)}(?=\\s|>|/)(?:[^>]*?)>`, 'gi');
  tagMatcher.lastIndex = searchFrom;
  let depth = 1;

  for (const match of content.matchAll(tagMatcher)) {
    const full = match[0];
    const isClosing = match[1] === '/';
    const isSelfClosing = !isClosing && full.endsWith('/>');
    if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        return { closeStart: match.index, closeEnd: match.index + full.length };
      }
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }

  throw new InvalidTemplateDataError(
    `El elemento con data-repeat="${collectionName}" no tiene etiqueta de cierre </${tagName}>.`,
  );
}

function buildItemScalars(
  baseScalars: Readonly<Record<string, string>>,
  collectionName: string,
  item: Readonly<Record<string, string>>,
): Record<string, string> {
  const merged: Record<string, string> = { ...baseScalars };
  const prefix = `${collectionName}.`;
  for (const [key, value] of Object.entries(item)) {
    if (key.startsWith(prefix)) {
      merged[key] = value;
    } else {
      merged[`${prefix}${key}`] = value;
      merged[key] = value;
    }
  }
  return merged;
}

function substituteScalars(content: string, scalars: Readonly<Record<string, string>>): string {
  return content.replace(SCALAR_PLACEHOLDER_PATTERN, (full, rawKey: string) => {
    const key = rawKey.trim();
    if (Object.prototype.hasOwnProperty.call(scalars, key)) {
      return escapeHtml(scalars[key]!);
    }
    return full;
  });
}

function renderBlock(content: string, data: TemplateRenderData): string {
  let output = '';
  let cursor = 0;

  while (cursor < content.length) {
    const slice = content.slice(cursor);
    const match = DATA_REPEAT_OPEN_TAG_PATTERN.exec(slice);
    if (!match) {
      output += substituteScalars(slice, data.scalars);
      break;
    }

    const matchStart = cursor + match.index;
    const openEnd = matchStart + match[0].length;
    const tagName = match[1]!;
    const collectionName = (match[3] ?? match[4] ?? '').trim();

    output += substituteScalars(content.slice(cursor, matchStart), data.scalars);

    const { closeStart, closeEnd } = findClosingTagRange(content, tagName, collectionName, openEnd);

    const openTag = match[0].replace(DATA_REPEAT_ATTR_PATTERN, '');
    const innerHtml = content.slice(openEnd, closeStart);
    const closeTag = content.slice(closeStart, closeEnd);
    const items = Object.prototype.hasOwnProperty.call(data.collections, collectionName)
      ? (data.collections[collectionName] ?? [])
      : [];

    for (const item of items) {
      const itemScalars = buildItemScalars(data.scalars, collectionName, item);
      const renderedInner = renderBlock(innerHtml, {
        scalars: itemScalars,
        collections: data.collections,
      });
      output += `${openTag}${renderedInner}${closeTag}`;
    }

    cursor = closeEnd;
  }

  return output;
}

/**
 * Renderiza el HTML de una plantilla sustituyendo variables escalares y bloques `data-repeat`.
 * Todos los valores se escapan contra HTML; las variables sin dato quedan literales (`{{clave}}`).
 */
export function renderTemplateHtml(content: string, data: TemplateRenderData): string {
  return renderBlock(content, data);
}
