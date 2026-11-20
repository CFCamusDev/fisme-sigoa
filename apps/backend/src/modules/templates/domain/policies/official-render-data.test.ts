import { describe, expect, it } from 'vitest';
import { buildOfficialRenderData, OFFICIAL_MISSING_SCALAR_VALUE } from './official-render-data.js';
import { renderTemplateHtml } from './template-renderer.js';

describe('buildOfficialRenderData (T-070-08)', () => {
  it('fills every declared scalar with a dash when the providers give no data', () => {
    const data = buildOfficialRenderData(
      [
        { key: 'schedule.period', label: 'Periodo' },
        { key: 'schedule.version', label: 'Versión' },
      ],
      {},
    );

    expect(data.scalars).toEqual({
      'schedule.period': OFFICIAL_MISSING_SCALAR_VALUE,
      'schedule.version': OFFICIAL_MISSING_SCALAR_VALUE,
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
    expect(data.scalars['schedule.period']).toBe(OFFICIAL_MISSING_SCALAR_VALUE);
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
    expect(rendered).toContain(`<span>${OFFICIAL_MISSING_SCALAR_VALUE}</span>`);
    expect(rendered).toContain(`<p>Periodo: ${OFFICIAL_MISSING_SCALAR_VALUE}</p>`);
    expect(rendered).not.toContain('data-repeat');
  });
});
