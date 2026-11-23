import { describe, expect, it } from 'vitest';
import { InvalidTemplateDataError } from '../errors/index.js';
import {
  sanitizeTemplateContent,
  validateTemplateContent,
  validateTemplateStructure,
} from './template-content-policy.js';

const KEYS = ['program.name', 'logo.url', 'minutes.number'];

function rejects(content: string, keys: readonly string[] = KEYS): void {
  expect(() => validateTemplateContent(content, keys)).toThrow(InvalidTemplateDataError);
}

function accepts(content: string, keys: readonly string[] = KEYS): void {
  expect(() => validateTemplateContent(content, keys)).not.toThrow();
}

describe('validateTemplateContent (T-018-21, D8)', () => {
  describe('forbidden tags', () => {
    it.each([
      '<script>alert(1)</script>',
      '<SCRIPT >alert(1)</SCRIPT>',
      '<scr<script>ipt>alert(1)</script>',
      '<iframe src="#"></iframe>',
      '<frame src="#">',
      '<frameset></frameset>',
      '<object data="#"></object>',
      '<embed src="#">',
      '<applet code="x"></applet>',
      '<link rel="stylesheet" href="#">',
      '<base href="#">',
      '<form action="#"></form>',
      '<input type="text">',
      '<button>x</button>',
      '<svg onload="x"></svg>',
      '<svg><circle /></svg>',
      '<math></math>',
      '</ script>',
    ])('rejects %s', (content) => {
      rejects(`<p>texto</p>${content}`);
    });

    it('rejects <meta http-equiv> and accepts a plain <meta charset>', () => {
      rejects('<meta http-equiv="refresh" content="0;url=#">');
      accepts('<meta charset="utf-8"><p>x</p>');
    });

    it('does not confuse similar tag names', () => {
      accepts('<p>a</p><section>b</section><format>c</format>');
    });
  });

  describe('attributes', () => {
    it.each([
      '<img src="#" onerror="x()">',
      '<p onclick="x()">a</p>',
      '<p\nonclick\n=\n"x()">a</p>',
      '<p ONMOUSEOVER=x>a</p>',
      '<p onclick = x>a</p>',
      '<iframe srcdoc="x"></iframe>',
      '<img/src=x onerror=x>',
    ])('rejects %s', (content) => {
      rejects(content);
    });

    it.each([
      '<a href="javascript:alert(1)">x</a>',
      '<a href="JaVa\nScript:alert(1)">x</a>',
      '<a href="jav&#x61;script:alert(1)">x</a>',
      '<a href="jav&#97;script&colon;alert(1)">x</a>',
      '<a href="java&Tab;script:alert(1)">x</a>',
      '<a href="vbscript:x">x</a>',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
      '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
      '<img src="http://externo.example/a.png">',
      '<img src="https://externo.example/a.png">',
      '<img src="//externo.example/a.png">',
      '<img src="ftp://externo.example/a.png">',
      '<img srcset="a.png 1x, https://externo.example/b.png 2x">',
      '<video poster="https://externo.example/p.png"></video>',
      '<a xlink:href="javascript:x">x</a>',
      '<a href=javascript:alert(1)>x</a>',
    ])('rejects the unsafe link in %s', (content) => {
      rejects(content);
    });

    it.each([
      '<img src="{{logo.url}}">',
      '<img src="data:image/png;base64,iVBORw0KGgo=">',
      '<a href="#seccion">x</a>',
      '<a href="mailto:programa@example.test">x</a>',
      '<img src="logo.png">',
      '<img src="">',
    ])('accepts %s', (content) => {
      accepts(content);
    });

    it('rejects an external url() in a style attribute', () => {
      rejects('<p style="background:url(https://externo.example/a.png)">x</p>');
    });

    it('accepts a harmless style attribute', () => {
      accepts('<p style="margin:0;font-weight:bold">x</p>');
    });
  });

  describe('style blocks', () => {
    it('accepts @page and ordinary rules', () => {
      accepts('<style>@page{size:A4;margin:20mm}table{border-collapse:collapse}</style><p>x</p>');
    });

    it.each([
      '@import url(https://externo.example/a.css);',
      "@import 'a.css';",
      'p{width:expression(alert(1))}',
      'p{background:url(https://externo.example/a.png)}',
      'p{background:url("//externo.example/a.png")}',
      'p{background:url(data:text/html,x)}',
      'p{background:\\75rl(https://externo.example/a.png)}',
    ])('rejects %s', (css) => {
      rejects(`<style>${css}</style><p>x</p>`);
    });

    it('accepts an embedded image in url()', () => {
      accepts('<style>p{background:url(data:image/png;base64,iVBORw0KGgo=)}</style>');
    });
  });

  describe('malformed markup and comments', () => {
    it.each(['<p>a<b</p>', '<?php echo 1 ?>', '<p class="a>x</p>'])(
      'still rejects a malformed tag (%s)',
      (content) => {
        rejects(content);
      },
    );

    it('accepts a well formed comment and drops it when sanitizing', () => {
      const html = '<!-- encabezado --><p>{{program.name}}</p><!-- fin -->';
      accepts(html);
      expect(sanitizeTemplateContent(html)).toBe('<p>{{program.name}}</p>');
    });

    it('drops conditional comments', () => {
      const html = '<!--[if IE]><p>legacy</p><![endif]--><p>ok</p>';
      accepts(html);
      expect(sanitizeTemplateContent(html)).toBe('<p>ok</p>');
    });

    it('rejects an unclosed comment and names the fragment', () => {
      expect(() =>
        validateTemplateContent('<p>hola</p><!-- comentario sin cierre aqui', KEYS),
      ).toThrow(/<!-- comentario sin cierre/);
    });

    it('rejects <!--> and <!---> openers', () => {
      rejects('<!--><script>alert(1)</script>');
      rejects('<!---><script>alert(1)</script>');
    });

    it('rejects a comment closed by --!>', () => {
      rejects('<!-- intento --!><script>alert(1)</script><!-- -->');
    });

    it('does not let a comment hide a script tag', () => {
      expect(sanitizeTemplateContent('<!-- <script>alert(1)</script> --><p>ok</p>')).toBe(
        '<p>ok</p>',
      );
      rejects('<!-- ok --><script>alert(1)</script>');
    });

    it('ignores variables inside comments', () => {
      accepts('<!-- {{variable.desconocida}} --><p>{{program.name}}</p>');
    });

    it('accepts a doctype and plain comparison text', () => {
      accepts('<!DOCTYPE html><p>3 < 5 y 7 > 2</p>');
    });
  });

  describe('variables', () => {
    it('accepts the allowed variables, repeated and inside attributes', () => {
      accepts('<p>{{program.name}} {{program.name}}</p><img src="{{logo.url}}">');
    });

    it.each(['{{ 7*7 }}', '{{unknown.key}}', '{{program.name }}', '{{Program.name}}', '{{}}'])(
      'rejects the variable %s',
      (content) => {
        rejects(`<p>${content}</p>`);
      },
    );

    it('rejects an unclosed variable', () => {
      rejects('<p>{{program.name</p>');
      rejects('<p>{{program.name}} {{minutes.number</p>');
    });

    it('lists at most five distinct unknown variables in the message', () => {
      const content = `<p>${['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => `{{${key}}}`).join('')}</p>`;
      let message = '';
      try {
        validateTemplateContent(content, KEYS);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain('a, b, c, d, e');
      expect(message).not.toContain(', f');
    });

    it('rejects every variable when the template declares none', () => {
      rejects('<p>{{program.name}}</p>', []);
      accepts('<p>sin variables</p>', []);
    });
  });

  describe('validateTemplateStructure', () => {
    it('validates structure without checking variables', () => {
      expect(() =>
        validateTemplateStructure('<p>{{unknown.key}} {{}} {{sinCerrar</p>'),
      ).not.toThrow();
      expect(() => validateTemplateStructure('<script>alert(1)</script>')).toThrow(
        InvalidTemplateDataError,
      );
    });
  });
});
