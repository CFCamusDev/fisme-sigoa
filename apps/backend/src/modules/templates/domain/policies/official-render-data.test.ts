import { describe, expect, it } from 'vitest';
import {
  ANNEX_MISSING_VALUE_TEXT,
  buildOfficialRenderData,
  OFFICIAL_MISSING_SCALAR_VALUE,
} from './official-render-data.js';
import { renderTemplateHtml } from './template-renderer.js';

describe('buildOfficialRenderData (T-070-08)', () => {
  it('uses the annex specific text for missing data and keeps the dash elsewhere', () => {
    const data = buildOfficialRenderData(
      [
        { key: 'process.name', label: 'Proceso' },
        { key: 'schedule.period', label: 'Periodo' },
        { key: 'schedule.version', label: 'Versión' },
        { key: 'results.indirect', label: 'Resultado indirecto' },
      ],
      {},
    );

    expect(data.scalars).toEqual({
      'process.name': ANNEX_MISSING_VALUE_TEXT['process.name'],
      'schedule.period': ANNEX_MISSING_VALUE_TEXT['schedule.period'],
      'schedule.version': ANNEX_MISSING_VALUE_TEXT['schedule.version'],
      'results.indirect': OFFICIAL_MISSING_SCALAR_VALUE,
    });
  });

  it('leaves collections without rows when no provider supplies them', () => {
    const html =
      '<table><tbody><tr data-repeat="activities"><td>{{activities.name}}</td></tr></tbody></table>';

    const data = buildOfficialRenderData(
      [{ key: 'activities.name', label: 'Nombre de la actividad' }],
      {},
      html,
    );

    expect(data.collections.activities).toEqual([]);
  });

  it('keeps the values supplied by the providers', () => {
    const html =
      '<img src="{{logo.url}}" /><p>{{schedule.period}}</p><table><tr data-repeat="activities"><td>{{activities.name}}</td></tr></table>';

    const data = buildOfficialRenderData(
      [
        { key: 'logo.url', label: 'Escudo' },
        { key: 'schedule.period', label: 'Periodo' },
        { key: 'activities.name', label: 'Actividad' },
      ],
      {
        scalars: { 'logo.url': 'data:image/png;base64,AAAA' },
        collections: {
          activities: [{ name: 'Reunión inicial' }],
        },
      },
      html,
    );

    expect(data.scalars['logo.url']).toBe('data:image/png;base64,AAAA');
    expect(data.scalars['schedule.period']).toBe(ANNEX_MISSING_VALUE_TEXT['schedule.period']);
    expect(data.collections.activities).toEqual([{ name: 'Reunión inicial' }]);
  });

  it('never leaves a placeholder after rendering', () => {
    const html = [
      '<header><img src="{{logo.url}}" /><span>{{process.name}}</span></header>',
      '<p>Periodo: {{schedule.period}}</p>',
      '<table><tbody><tr data-repeat="activities"><td>{{activities.number}}</td><td>{{activities.name}}</td></tr></tbody></table>',
    ].join('');

    const data = buildOfficialRenderData(
      [
        { key: 'logo.url', label: 'Escudo' },
        { key: 'process.name', label: 'Proceso' },
        { key: 'schedule.period', label: 'Periodo' },
        { key: 'activities.number', label: 'N.º' },
        { key: 'activities.name', label: 'Nombre' },
      ],
      {
        scalars: { 'logo.url': 'data:image/png;base64,AAAA' },
      },
      html,
    );

    const rendered = renderTemplateHtml(html, data);

    expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
    expect(rendered).toContain(`<span>${ANNEX_MISSING_VALUE_TEXT['process.name']}</span>`);
    expect(rendered).toContain(`<p>Periodo: ${ANNEX_MISSING_VALUE_TEXT['schedule.period']}</p>`);
    expect(rendered).not.toContain('data-repeat');
  });
});
