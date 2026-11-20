import { escapeHtml } from '../domain/policies/template-renderer.js';

export interface AnnexPdfFooterInput {
  readonly templateCode: string;
  readonly versionNumber: number;
  readonly generatedAt: Date;
}

const FOOTER_DATE_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatFooterTimestamp(date: Date): string {
  const parts = FOOTER_DATE_FORMATTER.formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const day = byType.get('day') ?? '01';
  const month = byType.get('month') ?? '01';
  const year = byType.get('year') ?? '1970';
  const hour = byType.get('hour') ?? '00';
  const minute = byType.get('minute') ?? '00';
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Construye el pie HTML de Puppeteer para anexos oficiales con código, versión, fecha es-PE y paginación.
 */
export function buildAnnexPdfFooter(input: AnnexPdfFooterInput): string {
  const code = escapeHtml(input.templateCode);
  const version = escapeHtml(String(input.versionNumber));
  const timestamp = escapeHtml(formatFooterTimestamp(input.generatedAt));

  return (
    '<div style="width:100%;padding:0 12mm;display:flex;justify-content:space-between;align-items:center;' +
    'font-size:8px;color:#475569;font-family:sans-serif;">' +
    `<span>${code} · Versión ${version} · Generado el ${timestamp}</span>` +
    '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>' +
    '</div>'
  );
}
