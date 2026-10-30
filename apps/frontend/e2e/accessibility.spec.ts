import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation and Focus Indicator (WCAG 2.1 AA)', () => {
  test('interactive controls display a visible computed focus indicator when navigated with Tab', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.goto('/');

    // 1. Skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Saltar al contenido principal/i });
    await expect(skipLink).toBeFocused();

    const skipHasFocusRing = await skipLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    });
    expect(skipHasFocusRing).toBe(true);

    // 2. Enlace de navegación
    await page.keyboard.press('Tab');
    const navLink = page.getByRole('link', { name: /Panel/i });
    await expect(navLink).toBeFocused();

    const navHasFocusRing = await navLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none' ||
        style.backgroundColor !== 'transparent'
      );
    });
    expect(navHasFocusRing).toBe(true);

    // 3. Botón de acción en el dashboard
    await page.keyboard.press('Tab');
    const actionButton = page.getByRole('button', { name: /Comprobar estado/i });
    await expect(actionButton).toBeFocused();

    const buttonHasFocusRing = await actionButton.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    });
    expect(buttonHasFocusRing).toBe(true);
  });

  test('navigates sidebar menu items using keyboard only', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');

    // Saltar el skip link y enfocarse en el enlace de navegación
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const panelLink = page.getByRole('link', { name: /Panel/i });
    await expect(panelLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(panelLink).toHaveAttribute('aria-current', 'page');
  });
});
