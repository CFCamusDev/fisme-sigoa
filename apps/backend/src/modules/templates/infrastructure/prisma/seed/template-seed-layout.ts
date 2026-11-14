/**
 * Maquetación común de las plantillas oficiales sembradas (HU-018, RN-040, D10, D13).
 * Todo el CSS va en línea (el HTML publicado no puede enlazar hojas externas), es legible en
 * blanco y negro y repite la cabecera de las tablas en cada página del PDF. La numeración de
 * página y el pie «Plantilla vX» los dibuja el generador del PDF, no la plantilla.
 */

export const INSTITUTION_NAME = 'Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas';
export const FACULTY_NAME = 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica';
export const PROGRAM_NAME = 'Programa de Estudios de Ingeniería de Sistemas';

function baseStyles(landscape: boolean): string {
  const size = landscape ? 'A4 landscape' : 'A4';
  return [
    `@page{size:${size};margin:18mm 16mm 20mm 16mm}`,
    '*{box-sizing:border-box}',
    'body{font-family:"Segoe UI","Open Sans",Arial,sans-serif;font-size:10.5pt;line-height:1.45;color:#1f2937}',
    '.doc-header{display:flex;align-items:center;gap:5mm;padding-bottom:4mm;border-bottom:1.5pt solid #1d4570;margin-bottom:6mm}',
    '.doc-header img{width:20mm;height:20mm}',
    '.org{font-size:7.5pt;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#5b6b80}',
    '.title{font-size:15pt;font-weight:700;color:#1d4570;line-height:1.2}',
    '.code{margin-left:auto;text-align:right;font-size:8.5pt;color:#5b6b80;white-space:nowrap}',
    'h2{font-size:12pt;font-weight:700;color:#1d4570;margin:6mm 0 2mm;break-after:avoid}',
    'p{margin:0 0 2mm}',
    'table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9pt}',
    'thead{display:table-header-group}',
    'tr{break-inside:avoid}',
    'th,td{border:.5pt solid #64748b;padding:1.5mm 2mm;text-align:left;vertical-align:top}',
    'th{background:#eaf1f8;font-weight:700}',
    '.fields td:first-child{width:36%;font-weight:700;background:#eaf1f8}',
    '.signatures{display:flex;gap:10mm;margin-top:18mm}',
    '.signature{flex:1;border-top:.5pt solid #1f2937;padding-top:1.5mm;text-align:center;font-size:9pt}',
    '.note{font-size:8.5pt;color:#5b6b80}',
    '.blank{border-bottom:.5pt solid #64748b;min-height:6mm}',
  ].join('\n');
}

export interface DocumentOptions {
  readonly code: string;
  readonly title: string;
  readonly body: string;
  readonly landscape?: boolean;
}

/** Documento HTML completo con el encabezado institucional (RN-040) y el escudo `{{logo.url}}`. */
export function documentHtml(options: DocumentOptions): string {
  const header = [
    '<div class="doc-header">',
    `<img src="{{logo.url}}" alt="Escudo de la ${INSTITUTION_NAME}">`,
    '<div>',
    `<div class="org">${INSTITUTION_NAME}</div>`,
    `<div class="org">${FACULTY_NAME} · ${PROGRAM_NAME}</div>`,
    `<div class="title">${options.title}</div>`,
    '</div>',
    `<div class="code">${options.code}</div>`,
    '</div>',
  ].join('\n');
  return [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${options.title}</title>`,
    `<style>\n${baseStyles(options.landscape ?? false)}\n</style>`,
    '</head>',
    '<body>',
    header,
    options.body,
    '</body>',
    '</html>',
  ].join('\n');
}

/** Variable de la plantilla: `{{clave}}`. */
export const v = (key: string): string => `{{${key}}}`;

export const section = (title: string, inner: string): string => `<h2>${title}</h2>\n${inner}`;

export const paragraph = (text: string): string => `<p>${text}</p>`;

export const note = (text: string): string => `<p class="note">${text}</p>`;

export const th = (text: string): string => `<th>${text}</th>`;
export const td = (content: string): string => `<td>${content}</td>`;
/** Encabezado que se repite una vez por elemento de la colección. */
export const thRepeat = (collection: string, content: string): string =>
  `<th data-repeat="${collection}">${content}</th>`;
export const tdRepeat = (collection: string, content: string): string =>
  `<td data-repeat="${collection}">${content}</td>`;

const row = (cells: readonly string[], repeat?: string): string =>
  `<tr${repeat ? ` data-repeat="${repeat}"` : ''}>${cells.join('')}</tr>`;

/** Tabla de filas fijas; `head` y `rows` ya son celdas (`th`/`td`). */
export function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    '<table>',
    `<thead>${row(head)}</thead>`,
    `<tbody>${rows.map((cells) => row(cells)).join('')}</tbody>`,
    '</table>',
  ].join('\n');
}

/** Tabla cuya fila se repite una vez por elemento de `collection` (convención D10). */
export function repeatTable(options: {
  readonly head: readonly string[];
  readonly collection: string;
  readonly cells: readonly string[];
}): string {
  return [
    '<table>',
    `<thead>${row(options.head)}</thead>`,
    `<tbody>${row(options.cells, options.collection)}</tbody>`,
    '</table>',
  ].join('\n');
}

/** Tabla de datos generales: etiqueta fija y variable por fila. */
export function fields(pairs: readonly (readonly [label: string, key: string])[]): string {
  return [
    '<table class="fields">',
    `<tbody>${pairs.map(([label, key]) => row([td(label), td(v(key))])).join('')}</tbody>`,
    '</table>',
  ].join('\n');
}

/** Datos que el encuestado completa a mano: etiqueta y línea en blanco. */
export function blankFields(labels: readonly string[]): string {
  return [
    '<table class="fields">',
    `<tbody>${labels.map((label) => row([td(label), '<td class="blank"></td>'])).join('')}</tbody>`,
    '</table>',
  ].join('\n');
}

/** Bloque de firmas con una columna por firmante (`signers`). */
export function signatures(): string {
  return [
    '<div class="signatures">',
    `<div class="signature" data-repeat="signers"><strong>${v('signers.name')}</strong><br>${v('signers.role')}</div>`,
    '</div>',
  ].join('\n');
}

export const MONTHS = [
  ['mar', 'Mar'],
  ['apr', 'Abr'],
  ['may', 'May'],
  ['jun', 'Jun'],
  ['jul', 'Jul'],
  ['aug', 'Ago'],
  ['sep', 'Sep'],
  ['oct', 'Oct'],
  ['nov', 'Nov'],
  ['dec', 'Dic'],
] as const;
