import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

export const DESKTOP = { width: 1280, height: 720 };
export const MOBILE = { width: 375, height: 812 };

export async function waitForApi(page: Page, fragment: string, goTo: () => Promise<unknown>) {
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(fragment) && res.status() === 200),
    goTo(),
  ]);
  expect(response.ok()).toBe(true);
}

export interface ContrastOptions {
  /**
   * Nombre legible de la pantalla o estado bajo prueba (ej. "Login (escritorio)").
   */
  screen?: string;
  /**
   * Selectores CSS a incluir en el análisis.
   */
  include?: string | string[];
  /**
   * Selectores CSS a excluir justificadamente del análisis.
   */
  exclude?: string | string[];
  /**
   * Si es true, la prueba falla ante nodos cuyo contraste no pudo ser calculado
   * automáticamente por axe (ej. fondos complejos o degradados). Por defecto false.
   */
  failOnIncomplete?: boolean;
}

/**
 * Verifica que todos los elementos de la página o fragmento cumplan estrictamente
 * con la regla de contraste de color WCAG 2.1 AA (4.5:1 texto normal, 3:1 texto grande/bold).
 */
export async function expectNoContrastViolations(
  page: Page,
  options: ContrastOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withRules(['color-contrast']);

  if (options.include) {
    builder = builder.include(options.include);
  }

  if (options.exclude) {
    builder = builder.exclude(options.exclude);
  }

  // Esperar a que terminen las animaciones CSS (p. ej. fade-in de pestañas/diálogos)
  // antes de medir contraste para evitar lecturas con opacidad intermedia.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

  const results = await builder.analyze();
  const screenName = options.screen ?? 'la pantalla';

  // Manejo de nodos con resultado incompleto (axe no puede decidir con certeza)
  if (results.incomplete.length > 0) {
    for (const rule of results.incomplete) {
      for (const node of rule.nodes) {
        test.info().annotations.push({
          type: 'contrast-incomplete',
          description: `[${screenName}] Nodo: ${node.target.join(' ')} · ${node.failureSummary ?? 'Cálculo incompleto por fondo complejo o degradado'}`,
        });
      }
    }

    if (options.failOnIncomplete) {
      const incompleteMessages = results.incomplete.flatMap((rule) =>
        rule.nodes.map(
          (node) =>
            `  • Selector: ${node.target.join(' ')}\n    HTML: ${node.html}\n    Motivo: ${node.failureSummary}`,
        ),
      );
      throw new Error(
        `[Contraste WCAG 2.1 AA] Se encontraron ${incompleteMessages.length} elementos con contraste indeterminado en ${screenName} (failOnIncomplete=true):\n\n${incompleteMessages.join('\n\n')}`,
      );
    }
  }

  // Manejo de violaciones confirmadas
  if (results.violations.length > 0) {
    const violationMessages = results.violations.flatMap((rule) =>
      rule.nodes.map(
        (node) =>
          `  • Selector: ${node.target.join(' ')}\n    HTML: ${node.html}\n    Detalle: ${node.failureSummary}`,
      ),
    );

    throw new Error(
      `[Contraste WCAG 2.1 AA] Se encontraron ${violationMessages.length} violaciones de contraste en ${screenName} (mínimo exigido 4.5:1 texto normal, 3:1 texto grande):\n\n${violationMessages.join('\n\n')}`,
    );
  }
}
