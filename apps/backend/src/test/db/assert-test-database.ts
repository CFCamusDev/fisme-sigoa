/**
 * Valida que la URL de conexión corresponda estrictamente a una base de datos de prueba
 * cuyo nombre termine en `_test`.
 *
 * Previene categóricamente que una suite de pruebas o reset trunque o modifique
 * la base de datos de desarrollo (`sigoa_dev`) o de producción (`sigoa_prod`).
 */
export function assertTestDatabase(url: string | undefined): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      'No se ha especificado la URL de la base de datos de prueba. Configura TEST_DATABASE_URL o DATABASE_URL.',
    );
  }

  let dbName: string;
  try {
    const parsed = new URL(url);
    // pathname viene con '/', ej: '/sigoa_test'
    dbName = parsed.pathname.replace(/^\//, '');
  } catch (error) {
    throw new Error(
      `La URL de la base de datos de prueba no tiene un formato válido: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `Operación abortada por seguridad: la base de datos de pruebas debe terminar en '_test' (recibido: '${dbName || 'ninguno'}'). ` +
        `Esto previene el borrado accidental de entornos de desarrollo o producción.`,
    );
  }

  return url;
}

export function getTestDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'] || process.env['DATABASE_URL'];
  return assertTestDatabase(url);
}
