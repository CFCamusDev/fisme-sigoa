import { test, expect } from './support/test';
import { loginAsTestUser } from './support/seed-user';

const SEEDED_ROLES = [
  'ADMINISTRATOR',
  'COMMITTEE_PRESIDENT',
  'COMMITTEE_MEMBER',
  'PROGRAM_DIRECTOR',
  'TEACHER',
] as const;

test.describe('Layout Shell & Navigation (HU-082, T-082-41)', () => {
  test.setTimeout(90_000);

  test('keeps header above scrolled content and avoids vertical overflow on empty home at 1280x720', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });

    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();

    const homeMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(homeMetrics.scrollWidth).toBeLessThanOrEqual(homeMetrics.clientWidth);
    expect(homeMetrics.scrollHeight).toBeLessThanOrEqual(homeMetrics.clientHeight);

    await page.evaluate(() => {
      const filler = document.createElement('div');
      filler.style.height = '1800px';
      filler.setAttribute('data-e2e-scroll-filler', 'true');
      document.querySelector('main')?.appendChild(filler);
      window.scrollTo(0, 500);
    });

    const headerCoversTop = await page.evaluate(() => {
      const target = document.elementFromPoint(200, 32);
      return Boolean(target?.closest('header'));
    });
    expect(headerCoversTop).toBe(true);
  });

  test('renders navigation groups according to each of the 5 seeded roles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    for (const role of SEEDED_ROLES) {
      await loginAsTestUser(page, { roles: [role] });
      const nav = page.getByRole('navigation', { name: 'Navegación principal' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Panel' })).toBeVisible();

      if (role === 'ADMINISTRATOR') {
        await expect(nav.getByRole('button', { name: 'Administración' })).toBeVisible();
      } else {
        await expect(nav.getByRole('button', { name: 'Administración' })).toHaveCount(0);
      }
    }
  });

  test('opens mobile drawer at 375x812 and restores focus to trigger on close', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });

    const openButton = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await expect(openButton).toBeVisible();
    await openButton.click();

    const closeButton = page.getByRole('button', { name: 'Cerrar menú lateral' });
    await expect(closeButton).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(openButton).toBeFocused();
  });

  test('keeps permission screens within two viewport heights at 1280x720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAsTestUser(page, { roles: ['ADMINISTRATOR'] });

    await page.goto('/roles');
    await page
      .getByRole('link', { name: /Permisos/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar permisos' })).toBeVisible();

    const rolePermsHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(rolePermsHeight).toBeLessThanOrEqual(720 * 2);

    await page.goto('/usuarios');
    await page
      .getByRole('link', { name: /Editar/i })
      .first()
      .click();
    await page.getByRole('tab', { name: 'Permisos directos' }).click();
    await expect(page.getByRole('searchbox', { name: /Buscar permiso/i })).toBeVisible();

    const userDirectPermsHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(userDirectPermsHeight).toBeLessThanOrEqual(720 * 2);
  });
});
