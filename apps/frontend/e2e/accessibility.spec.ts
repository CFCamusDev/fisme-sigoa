import { test, expect, type Locator } from '@playwright/test';
import { loginAsTestUser } from './support/seed-user';

async function expectVisibleFocusIndicator(locator: Locator) {
  const hasFocusRing = await locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const hasOutline =
      style.outlineStyle !== 'none' && style.outlineWidth !== '0px' && style.outlineWidth !== '';
    const hasBoxShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
    return hasOutline || hasBoxShadow;
  });
  expect(hasFocusRing).toBe(true);
}

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
    await expectVisibleFocusIndicator(skipLink);

    // 2. Botón de cerrar sesión en el Header
    await page.keyboard.press('Tab');
    const logoutBtn = page.getByRole('button', { name: /Cerrar sesión/i });
    await expect(logoutBtn).toBeFocused();
    await expectVisibleFocusIndicator(logoutBtn);

    // 3. Enlaces de navegación en el sidebar (recorrido dinámico)
    const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
    const navLinks = mainNav.getByRole('link');
    const navCount = await navLinks.count();
    expect(navCount).toBeGreaterThan(0);

    for (let i = 0; i < navCount; i++) {
      await page.keyboard.press('Tab');
      const currentLink = navLinks.nth(i);
      await expect(currentLink).toBeFocused();
      await expectVisibleFocusIndicator(currentLink);
    }

    // 4. Botón de acción en el dashboard (primer control interactivo del contenido principal)
    await page.keyboard.press('Tab');
    const actionButton = page.getByRole('button', { name: /Comprobar estado/i });
    await expect(actionButton).toBeFocused();
    await expectVisibleFocusIndicator(actionButton);
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

  test('navigates to the users page with the keyboard only', async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsTestUser(page);

    // Skip link (Tab 1), Logout button (Tab 2)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Navegar con Tab a través de los enlaces de la barra lateral hasta llegar a «Usuarios»
    const usersLink = page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: /Usuarios/i });

    let isFocused = await usersLink.evaluate((el) => document.activeElement === el);
    let attempts = 0;
    while (!isFocused && attempts < 10) {
      await page.keyboard.press('Tab');
      isFocused = await usersLink.evaluate((el) => document.activeElement === el);
      attempts++;
    }

    await expect(usersLink).toBeFocused();
    await expectVisibleFocusIndicator(usersLink);

    await page.keyboard.press('Enter');

    // Verificar transición a /usuarios, estado aria-current y encabezado
    await expect(page).toHaveURL(/\/usuarios/);
    await expect(usersLink).toHaveAttribute('aria-current', 'page');
    const heading = page.getByRole('heading', { name: 'Usuarios', exact: true });
    await expect(heading).toBeVisible();
  });
});
