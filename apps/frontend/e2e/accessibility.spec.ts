import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './support/seed-user';

test.describe('Keyboard Navigation and Focus Indicator (WCAG 2.1 AA)', () => {
  test('interactive controls display a visible computed focus indicator when navigated with Tab', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await loginAsTestUser(page);

    // 1. Skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Saltar al contenido principal/i });
    await expect(skipLink).toBeFocused();

    const skipHasFocusRing = await skipLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    });
    expect(skipHasFocusRing).toBe(true);

    // 2. Botón de cerrar sesión en el Header
    await page.keyboard.press('Tab');
    const logoutBtn = page.getByRole('button', { name: /Cerrar sesión/i });
    await expect(logoutBtn).toBeFocused();

    const logoutHasFocusRing = await logoutBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none' ||
        style.backgroundColor !== 'transparent'
      );
    });
    expect(logoutHasFocusRing).toBe(true);

    // 3. Enlace de navegación en el sidebar
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

    // 4. Botón de acción en el dashboard
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
    await loginAsTestUser(page);

    // Skip link (Tab 1), Logout button (Tab 2), Nav link Panel (Tab 3)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const panelLink = page.getByRole('link', { name: /Panel/i });
    await expect(panelLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(panelLink).toHaveAttribute('aria-current', 'page');
  });
});
