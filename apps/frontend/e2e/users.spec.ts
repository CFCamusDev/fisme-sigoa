import { test, expect } from '@playwright/test';
import { seedUser } from './support/seed-user';

test.describe('HU-003 — Gestión de usuarios E2E', () => {
  test.setTimeout(60_000);

  test('administrator creates a user and deactivates another (CA1, CA3, CA4)', async ({
    page,
    browser,
  }) => {
    const timestamp = Date.now();
    const adminEmail = `admin-${timestamp}@example.test`;
    const adminPassword = 'Password123!';
    const adminDni = String(10000000 + (timestamp % 10000000));

    const otherUserEmail = `docente-activo-${timestamp}@example.test`;
    const otherUserPassword = 'Password123!';
    const otherUserDni = String(20000000 + (timestamp % 10000000));

    const newUserDni = String(30000000 + (timestamp % 10000000));

    // 1. Sembrado del administrador y de un usuario docente activo
    seedUser({
      email: adminEmail,
      password: adminPassword,
      names: 'Administrador',
      firstSurname: 'Principal',
      roles: ['ADMINISTRATOR'],
      status: 'ACTIVE',
      dni: adminDni,
    });

    const uniqueDocenteSurname = `Activo${timestamp % 10000}`;

    seedUser({
      email: otherUserEmail,
      password: otherUserPassword,
      names: 'Docente',
      firstSurname: uniqueDocenteSurname,
      roles: ['TEACHER'],
      status: 'ACTIVE',
      dni: otherUserDni,
    });

    // 2. Administrador inicia sesión
    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(adminEmail);
    await page.getByLabel(/contraseña/i).fill(adminPassword);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'FISME-SIGOA' })).toBeVisible();

    // 3. Navega al módulo de usuarios
    const usersNavItem = page.getByRole('link', { name: /^usuarios$/i });
    await usersNavItem.click();

    await expect(page).toHaveURL(/\/usuarios/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expect(page.getByText(`Docente ${uniqueDocenteSurname}`)).toBeVisible();

    // 4. Crear nuevo usuario (CA1)
    await page.getByRole('link', { name: /nuevo usuario/i }).click();
    await expect(page).toHaveURL('/usuarios/nuevo');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo usuario' })).toBeVisible();

    const newUserEmail = `ana.valle.${timestamp}@example.test`;
    await page.getByLabel(/nombres/i).fill('Ana');
    await page.getByLabel(/primer apellido/i).fill('Valle');
    await page.getByLabel(/correo electrónico/i).fill(newUserEmail);
    await page.getByLabel(/dni/i).fill(newUserDni);

    // Seleccionar rol Docente
    const teacherCheckbox = page.getByRole('checkbox', { name: /docente/i });
    await teacherCheckbox.check();

    await page.getByRole('button', { name: /crear usuario/i }).click();

    // Mensaje de éxito con aviso de activación
    await expect(page.getByText(/usuario creado exitosamente/i)).toBeVisible();
    await expect(page.getByText(newUserEmail)).toBeVisible();

    // Volver a la lista y verificar que aparece con estado «Pendiente de activación»
    await page.getByRole('link', { name: /volver a la lista/i }).click();
    await expect(page).toHaveURL(/\/usuarios/);
    const anaRow = page.getByRole('row', { name: /ana valle/i });
    await expect(anaRow).toBeVisible();
    await expect(anaRow.getByText('Pendiente de activación')).toBeVisible();

    // 5. Filtrar por estado «Activo» (CA4)
    const statusFilter = page.getByLabel(/filtrar por estado/i);
    await statusFilter.selectOption('ACTIVE');

    await expect(page.getByText(`Docente ${uniqueDocenteSurname}`)).toBeVisible();

    // 6. Inactivar al usuario activo con confirmación (CA3)
    const deactivateBtn = page.getByRole('button', {
      name: new RegExp(`inactivar a docente ${uniqueDocenteSurname}`, 'i'),
    });
    await deactivateBtn.click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        new RegExp(
          `¿inactivar a docente ${uniqueDocenteSurname}\\? se cerrarán sus sesiones activas\\.`,
          'i',
        ),
      ),
    ).toBeVisible();

    const confirmDeactivateBtn = dialog.getByRole('button', {
      name: /confirmar inactivación/i,
    });
    await confirmDeactivateBtn.click();

    await expect(
      page.getByText(
        new RegExp(
          `se inactivó la cuenta de docente ${uniqueDocenteSurname} correctamente\\.`,
          'i',
        ),
      ),
    ).toBeVisible();

    // 7. Comprobar que el usuario inactivado ya no puede iniciar sesión
    const incognitoContext = await browser.newContext();
    const otherUserPage = await incognitoContext.newPage();

    await otherUserPage.goto('/login');
    await otherUserPage.getByLabel(/correo electrónico/i).fill(otherUserEmail);
    await otherUserPage.getByLabel(/contraseña/i).fill(otherUserPassword);
    await otherUserPage.getByRole('button', { name: /acceder al sistema/i }).click();

    const inactiveAlert = otherUserPage.getByRole('alert');
    await expect(inactiveAlert).toBeVisible();
    await expect(inactiveAlert).toHaveText(/tu cuenta está inactiva/i);
    await incognitoContext.close();

    // 8. El administrador reactiva al usuario
    await statusFilter.selectOption('INACTIVE');
    await expect(page.getByText(`Docente ${uniqueDocenteSurname}`)).toBeVisible();

    const reactivateBtn = page.getByRole('button', {
      name: new RegExp(`reactivar a docente ${uniqueDocenteSurname}`, 'i'),
    });
    await reactivateBtn.click();

    await expect(
      page.getByText(
        new RegExp(
          `se reactivó la cuenta de docente ${uniqueDocenteSurname} correctamente\\.`,
          'i',
        ),
      ),
    ).toBeVisible();
  });

  test('shows the permission message to a user without access', async ({ page }) => {
    const timestamp = Date.now();
    const teacherEmail = `docente-sin-permiso-${timestamp}@example.test`;
    const teacherPassword = 'Password123!';

    seedUser({
      email: teacherEmail,
      password: teacherPassword,
      names: 'Docente',
      firstSurname: 'Regular',
      roles: ['TEACHER'],
      status: 'ACTIVE',
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill(teacherEmail);
    await page.getByLabel(/contraseña/i).fill(teacherPassword);
    await page.getByRole('button', { name: /acceder al sistema/i }).click();

    await expect(page).toHaveURL('/');

    // Abre /usuarios directamente
    await page.goto('/usuarios');

    // Debe mostrar el mensaje de 403 del servidor sin reintento
    await expect(page.getByText('Acceso restringido')).toBeVisible();
    await expect(page.getByText('No tienes permiso para ver los usuarios.')).toBeVisible();
  });
});
