import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';
import { detectUnrecognizedVariables } from './unrecognized-variable-detector.js';

/**
 * Política de contenido seguro de una plantilla (HU-018, RS-063). Rechaza, no sanea: el
 * administrador corrige el aviso. Es una defensa de primera línea basada en patrones; la defensa
 * de fondo es del renderizado (JavaScript desactivado e intercepción de peticiones en el PDF).
 */

const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'base',
  'form',
  'input',
  'button',
  'svg',
  'math',
] as const;

const FORBIDDEN_TAG_PATTERN = new RegExp(
  `<\\s*\\/?\\s*(${FORBIDDEN_TAGS.join('|')})(?![a-zA-Z0-9])`,
  'i',
);
const META_HTTP_EQUIV_PATTERN = /<\s*meta\b[^>]*http-equiv/i;

const URL_ATTRIBUTES = new Set([
  'src',
  'href',
  'srcset',
  'poster',
  'action',
  'formaction',
  'xlink:href',
  'background',
]);

const OPEN_TAG_PATTERN =
  /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>=`]+))?)*)\s*\/?>/g;
const CLOSE_TAG_PATTERN = /<\/[a-zA-Z][a-zA-Z0-9:-]*\s*>/g;
const ATTRIBUTE_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+)))?/g;
const STYLE_BLOCK_PATTERN = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/;
const WHOLE_VARIABLE_PATTERN = /^\{\{[^{}]+\}\}$/;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  sol: '/',
  lpar: '(',
  rpar: ')',
};

function fail(message: string): never {
  throw new InvalidTemplateDataError(message);
}

/** Decodifica entidades, quita espacios y controles y pasa a minúsculas (`jav&#x61;script:`). */
function normalizeAttributeValue(value: string): string {
  const decoded = value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
  return stripSpacesAndControls(decoded).toLowerCase();
}

function stripSpacesAndControls(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) {
      continue;
    }
    result += char;
  }
  return result;
}

function safeFromCodePoint(codePoint: number): string {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : '';
}

function isSafeUrl(rawValue: string): boolean {
  if (WHOLE_VARIABLE_PATTERN.test(rawValue.trim())) {
    return true;
  }
  const value = normalizeAttributeValue(rawValue);
  if (value === '' || value.startsWith('#')) {
    return true;
  }
  if (SAFE_DATA_IMAGE_PATTERN.test(value)) {
    return true;
  }
  if (value.startsWith('//') || value.startsWith('\\')) {
    return false;
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(value);
  if (scheme) {
    return scheme[1] === 'mailto' || scheme[1] === 'tel';
  }
  return true;
}

function assertSafeUrlAttribute(name: string, rawValue: string): void {
  const candidates =
    name === 'srcset'
      ? rawValue.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '')
      : [rawValue];
  for (const candidate of candidates) {
    if (!isSafeUrl(candidate)) {
      fail(
        `El atributo ${name} contiene un enlace no permitido. Solo se admiten anclas (#), imágenes incrustadas (data:image) y variables.`,
      );
    }
  }
}

function assertSafeCss(css: string, where: string): void {
  const normalized = normalizeAttributeValue(css);
  if (css.includes('\\')) {
    fail(`El estilo (${where}) no puede usar secuencias de escape.`);
  }
  if (normalized.includes('@import') || normalized.includes('expression(')) {
    fail(`El estilo (${where}) no puede usar @import ni expression().`);
  }
  if (normalized.includes('javascript:') || normalized.includes('behavior:')) {
    fail(`El estilo (${where}) contiene una construcción no permitida.`);
  }
  for (const match of normalized.matchAll(/url\(([^)]*)\)/g)) {
    const target = (match[1] ?? '').replace(/^["']|["']$/g, '');
    if (!(target.startsWith('#') || SAFE_DATA_IMAGE_PATTERN.test(target))) {
      fail(`El estilo (${where}) no puede cargar recursos con url(); usa imágenes incrustadas.`);
    }
  }
}

const COMMENT_FRAGMENT_LIMIT = 40;

function formatFragment(content: string, start: number): string {
  return content
    .slice(start, start + COMMENT_FRAGMENT_LIMIT)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Elimina comentarios HTML bien formados (`<!-- ... -->`) y rechaza comentarios sin cerrar o con
 * cierres ambiguos (`<!-->`, `<!--->`, `--!>`) antes de validar, guardar o renderizar (HU-081, T-081-31).
 */
export function sanitizeTemplateContent(content: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<!--', cursor);
    if (start === -1) {
      result += content.slice(cursor);
      break;
    }

    result += content.slice(cursor, start);

    const afterOpener = content.slice(start + 4);
    if (afterOpener.startsWith('>') || afterOpener.startsWith('->')) {
      const fragment = formatFragment(content, start);
      fail(
        `Hay un comentario HTML mal formado cerca de "${fragment}". Usa <!-- comentario --> con contenido válido.`,
      );
    }

    const end = content.indexOf('-->', start + 4);
    if (end === -1) {
      const fragment = formatFragment(content, start);
      fail(
        `Hay un comentario HTML sin cerrar o mal formado cerca de "${fragment}". Ciérralo con -->`,
      );
    }

    const body = content.slice(start + 4, end);
    if (body.includes('--!>')) {
      const fragment = formatFragment(content, start);
      fail(
        `Hay un comentario HTML mal formado cerca de "${fragment}". Ciérralo únicamente con -->`,
      );
    }

    cursor = end + 3;
  }

  return result;
}

function assertSafeStructure(content: string): void {
  if (FORBIDDEN_TAG_PATTERN.test(content)) {
    fail(
      'El contenido contiene una etiqueta no permitida (script, iframe, object, embed, link, base, form, svg u otra similar).',
    );
  }
  if (META_HTTP_EQUIV_PATTERN.test(content)) {
    fail('El contenido no puede usar <meta http-equiv>.');
  }

  for (const block of content.matchAll(STYLE_BLOCK_PATTERN)) {
    assertSafeCss(block[1] ?? '', '<style>');
  }

  for (const tag of content.matchAll(OPEN_TAG_PATTERN)) {
    const attributes = tag[2] ?? '';
    for (const attribute of attributes.matchAll(ATTRIBUTE_PATTERN)) {
      const name = (attribute[1] ?? '').toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
      if (name.startsWith('on')) {
        fail(`El atributo ${name} no está permitido: los manejadores de eventos se rechazan.`);
      }
      if (name === 'srcdoc') {
        fail('El atributo srcdoc no está permitido.');
      }
      if (URL_ATTRIBUTES.has(name)) {
        assertSafeUrlAttribute(name, value);
      }
      if (name === 'style') {
        assertSafeCss(value, 'atributo style');
      }
    }
  }

  // Lo que quede tras quitar etiquetas bien formadas no debe parecer una etiqueta.
  const remainder = content
    .replace(/<!doctype html>/i, '')
    .replace(OPEN_TAG_PATTERN, '')
    .replace(CLOSE_TAG_PATTERN, '');
  const malformedMatch = /<\s*[a-zA-Z/!?][^<>\n]{0,39}/.exec(remainder);
  if (malformedMatch) {
    const fragment = malformedMatch[0].replace(/\s+/g, ' ').trim();
    fail(
      `El contenido tiene una etiqueta HTML mal formada cerca de "${fragment}". Revisa los < y > del texto.`,
    );
  }
}

function assertAllowedVariables(content: string, allowedKeys: readonly string[]): void {
  const { unrecognized, hasUnclosed } = detectUnrecognizedVariables(content, allowedKeys);
  if (unrecognized.length > 0) {
    const shown = unrecognized.slice(0, 5).join(', ');
    fail(`El contenido usa variables que la plantilla no permite: ${shown}.`);
  }
  if (hasUnclosed) {
    fail('El contenido tiene una variable sin cerrar ({{ sin }}).');
  }
}

/**
 * Valida únicamente la estructura HTML/CSS y enlaces del contenido sin comprobar variables.
 * Útil en vista previa, donde las variables desconocidas se avisan pero no bloquean.
 */
export function validateTemplateStructure(content: string): void {
  const sanitized = sanitizeTemplateContent(content);
  assertSafeStructure(sanitized);
}

/**
 * Valida el HTML de una versión de plantilla. Lanza `InvalidTemplateDataError` (400) con un mensaje
 * en español ante etiquetas, atributos, enlaces o variables no permitidos.
 */
export function validateTemplateContent(content: string, allowedKeys: readonly string[]): void {
  const sanitized = sanitizeTemplateContent(content);
  assertSafeStructure(sanitized);
  assertAllowedVariables(sanitized, allowedKeys);
}
