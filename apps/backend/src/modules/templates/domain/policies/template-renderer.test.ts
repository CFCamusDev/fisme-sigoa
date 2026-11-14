import { describe, expect, it } from 'vitest';
import { InvalidTemplateDataError } from '../errors/index.js';
import { renderTemplateHtml } from './template-renderer.js';

describe('renderTemplateHtml (T-019-02)', () => {
  it('substitutes scalar variables and escapes their values', () => {
    const html = '<p>{{program.name}}</p><span title="{{author}}">{{author}}</span>';
    const rendered = renderTemplateHtml(html, {
      scalars: {
        'program.name': 'Ingeniería de Sistemas & <TI>',
        author: '"Ana" \'Pérez\'',
      },
      collections: {},
    });

    expect(rendered).toBe(
      '<p>Ingeniería de Sistemas &amp; &lt;TI&gt;</p><span title="&quot;Ana&quot; &#39;Pérez&#39;">&quot;Ana&quot; &#39;Pérez&#39;</span>',
    );
  });

  it('repeats a data-repeat element once per item', () => {
    const html =
      '<ul><li data-repeat="objectives">{{objectives.code}}: {{objectives.title}}</li></ul>';
    const rendered = renderTemplateHtml(html, {
      scalars: {},
      collections: {
        objectives: [
          { code: 'OE1', title: 'Formar profesionales' },
          { code: 'OE2', title: 'Impulsar investigación' },
        ],
      },
    });

    expect(rendered).toBe(
      '<ul><li>OE1: Formar profesionales</li><li>OE2: Impulsar investigación</li></ul>',
    );
  });

  it('repeats table cells and rows with nested same-name tags', () => {
    const html = [
      '<table>',
      '<thead><tr><th data-repeat="attributes">{{attributes.code}}</th></tr></thead>',
      '<tbody><tr data-repeat="rows"><td>{{rows.label}}<div><span>{{rows.detail}}</span></div></td></tr></tbody>',
      '</table>',
      '<div class="wrap" data-repeat="cards"><div class="inner">{{cards.name}}</div></div>',
    ].join('');

    const rendered = renderTemplateHtml(html, {
      scalars: {},
      collections: {
        attributes: [{ code: 'AG1' }, { code: 'AG2' }],
        rows: [{ label: 'R1', detail: 'D1' }],
        cards: [{ name: 'C1' }, { name: 'C2' }],
      },
    });

    expect(rendered).toBe(
      '<table><thead><tr><th>AG1</th><th>AG2</th></tr></thead><tbody><tr><td>R1<div><span>D1</span></div></td></tr></tbody></table><div class="wrap"><div class="inner">C1</div></div><div class="wrap"><div class="inner">C2</div></div>',
    );
  });

  it('leaves unknown variables literal', () => {
    const html = '<p>{{program.name}} - {{unknown.key}}</p>';
    const rendered = renderTemplateHtml(html, {
      scalars: { 'program.name': 'EPIS' },
      collections: {},
    });

    expect(rendered).toBe('<p>EPIS - {{unknown.key}}</p>');
  });

  it('rejects a data-repeat element without a closing tag', () => {
    const html = '<div data-repeat="items"><span>{{items.name}}</span>';
    expect(() =>
      renderTemplateHtml(html, {
        scalars: {},
        collections: { items: [{ name: 'A' }] },
      }),
    ).toThrow(InvalidTemplateDataError);
  });
});
