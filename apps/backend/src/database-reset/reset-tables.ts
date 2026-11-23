export const SYSTEM_IGNORED_TABLES = ['_prisma_migrations'] as const;

export const PRESERVED_TABLES = [
  'users',
  'user_roles',
  'user_permissions',
  'roles',
  'permissions',
  'role_permissions',
  'activation_tokens',
] as const;

export const RESET_TABLES = [
  'audit_logs',
  'audit_chain_heads',
  'stored_files',
  'refresh_tokens',
  'programs',
  'semesters',
  'parameters',
  'response_scales',
  'scale_levels',
  'catalog_versions',
  'educational_objectives',
  'graduate_attributes',
  'resolutions',
  'templates',
  'template_versions',
  'stakeholders',
  'stakeholder_lists',
  'stakeholder_list_members',
  'process_executions',
  'sessions',
  'session_executions',
  'attendees',
  'quality_committees',
  'committee_members',
  'schedule_activities',
] as const;

const REGISTERED_TABLES = new Set<string>([
  ...SYSTEM_IGNORED_TABLES,
  ...PRESERVED_TABLES,
  ...RESET_TABLES,
]);

/**
 * Devuelve las tablas existentes en el esquema `public` que no están registradas en
 * `PRESERVED_TABLES`, `RESET_TABLES` ni `SYSTEM_IGNORED_TABLES`.
 */
export function findUnregisteredTables(existingTables: readonly string[]): string[] {
  return existingTables.filter((table) => !REGISTERED_TABLES.has(table));
}
