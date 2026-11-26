import * as React from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PROTECTED_ROLE_CODE, type PermissionDto, type RoleDto } from '@sigoa/shared';
import { Search } from 'lucide-react';
import { StickyActionBar } from '@/components/common';
import { Can } from '@/components/common/can.js';
import { EmptyState } from '@/components/common/empty-state.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Select } from '@/components/ui/select.js';
import { cn } from '@/lib/utils.js';
import { useUpdateRolePermissions } from '../hooks/index.js';
import {
  buildDraft,
  countChanges,
  groupByModule,
  toUpdateRequest,
  type DraftScope,
  type PermissionDraft,
} from '../lib/permission-draft.js';
import { countAssigned, filterPermissions } from '../lib/permission-filter.js';
import { getRoleErrorMessage } from '../lib/role-error-message.js';
import { PermissionModuleTable } from './permission-module-table.js';

export interface PermissionMatrixEditorProps {
  role: RoleDto;
  catalog: readonly PermissionDto[];
  onSaveSuccess?: (updatedRole: RoleDto) => void;
  onDiscard?: () => void;
}

const PROTECTED_ADMIN_CODES = ['rol.ver', 'rol.editar'] as const;
const PROTECTED_HINT = 'El rol Administrador debe conservar este permiso con alcance Global';

export function PermissionMatrixEditor({
  role,
  catalog,
  onSaveSuccess,
  onDiscard,
}: PermissionMatrixEditorProps) {
  const searchInputId = React.useId();
  const mobileSelectId = React.useId();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown> | undefined;

  const updateMutation = useUpdateRolePermissions();

  const baseDraft = React.useMemo(() => buildDraft(role, catalog), [role, catalog]);
  const [overrides, setOverrides] = React.useState<Record<string, DraftScope>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const draft: PermissionDraft = React.useMemo(
    () => ({ ...baseDraft, ...overrides }),
    [baseDraft, overrides],
  );

  const changesCount = React.useMemo(() => countChanges(baseDraft, draft), [baseDraft, draft]);
  const isProtectedRole = role.code === PROTECTED_ROLE_CODE;
  const isPending = updateMutation.isPending;

  const groupedModules = React.useMemo(() => groupByModule(catalog), [catalog]);
  const moduleNames = React.useMemo(() => Object.keys(groupedModules), [groupedModules]);

  const rawModule = typeof search?.module === 'string' ? search.module : undefined;
  const activeModule =
    rawModule && moduleNames.includes(rawModule) ? rawModule : (moduleNames[0] ?? '');

  const setActiveModule = React.useCallback(
    (nextModule: string) => {
      if (!moduleNames.includes(nextModule)) {
        return;
      }
      void navigate({
        to: '.',
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          module: nextModule,
        })) as never,
        replace: true,
      });
    },
    [moduleNames, navigate],
  );

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const filteredModules = React.useMemo(
    () => (isSearching ? Object.entries(groupByModule(filterPermissions(catalog, query))) : []),
    [catalog, isSearching, query],
  );

  const handleScopeChange = (code: string, scope: DraftScope) => {
    setOverrides((prev) => ({
      ...prev,
      [code]: scope,
    }));
  };

  const handleSave = () => {
    if (isPending || changesCount === 0) return;
    setGeneralError(null);
    setSuccessMessage(null);

    const body = toUpdateRequest(draft);
    updateMutation.mutate(
      {
        id: role.id,
        body,
      },
      {
        onSuccess: (updatedRole) => {
          setOverrides({});
          setSuccessMessage('Los permisos se guardaron exitosamente.');
          onSaveSuccess?.(updatedRole);
        },
        onError: (err) => {
          setGeneralError(getRoleErrorMessage(err));
        },
      },
    );
  };

  const handleDiscard = () => {
    setOverrides({});
    setGeneralError(null);
    setSuccessMessage(null);
    onDiscard?.();
  };

  const activePermissions = groupedModules[activeModule] ?? [];

  return (
    <div className="space-y-6 pb-24">
      {successMessage && (
        <Alert variant="success" role="status">
          <AlertTitle>Éxito</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {generalError && (
        <Alert variant="danger" role="alert">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="space-y-1.5 lg:hidden">
          <Label htmlFor={mobileSelectId}>Módulo</Label>
          <Select
            id={mobileSelectId}
            aria-label="Seleccionar módulo"
            value={activeModule}
            onChange={(event) => setActiveModule(event.target.value)}
          >
            {moduleNames.map((name) => {
              const perms = groupedModules[name] ?? [];
              const assigned = countAssigned(draft, perms);
              return (
                <option key={name} value={name}>
                  {name} ({assigned}/{perms.length})
                </option>
              );
            })}
          </Select>
        </div>

        <nav
          aria-label="Módulos de permisos"
          className="hidden w-72 shrink-0 space-y-1 rounded-lg border border-border bg-card p-2 lg:block"
        >
          {moduleNames.map((name) => {
            const perms = groupedModules[name] ?? [];
            const assigned = countAssigned(draft, perms);
            const isActive = name === activeModule && !isSearching;

            return (
              <button
                key={name}
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => {
                  if (isSearching) {
                    setQuery('');
                  }
                  setActiveModule(name);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-label transition-colors motion-color focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isActive
                    ? 'bg-sidebar-active font-semibold text-sidebar-active-foreground'
                    : 'font-medium text-sidebar-foreground hover:bg-brand-50',
                )}
              >
                <span className="truncate">{name}</span>
                <span className="shrink-0 text-meta text-muted-foreground tabular">
                  {assigned}/{perms.length}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="max-w-md space-y-1.5">
            <Label htmlFor={searchInputId}>Buscar permisos</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchInputId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en todos los módulos..."
                className="pl-9"
              />
            </div>
          </div>

          {isSearching ? (
            filteredModules.length === 0 ? (
              <EmptyState
                title={`Ningún permiso coincide con “${trimmedQuery}”`}
                description="Prueba con otro término de código o descripción."
              />
            ) : (
              <div className="space-y-6">
                {filteredModules.map(([moduleName, permissions]) => (
                  <section key={moduleName} className="space-y-3">
                    <h2 className="text-h3 font-semibold text-foreground">{moduleName}</h2>
                    <PermissionModuleTable
                      moduleName={moduleName}
                      permissions={permissions}
                      baseDraft={baseDraft}
                      draft={draft}
                      disabled={isPending}
                      onScopeChange={handleScopeChange}
                      protectedCodes={isProtectedRole ? PROTECTED_ADMIN_CODES : undefined}
                      protectedHint={PROTECTED_HINT}
                    />
                  </section>
                ))}
              </div>
            )
          ) : activeModule ? (
            <section className="space-y-3">
              <h2 className="text-h3 font-semibold text-foreground">{activeModule}</h2>
              <PermissionModuleTable
                moduleName={activeModule}
                permissions={activePermissions}
                baseDraft={baseDraft}
                draft={draft}
                disabled={isPending}
                onScopeChange={handleScopeChange}
                protectedCodes={isProtectedRole ? PROTECTED_ADMIN_CODES : undefined}
                protectedHint={PROTECTED_HINT}
              />
            </section>
          ) : null}
        </div>
      </div>

      <Can permission="rol.editar">
        <StickyActionBar
          status={
            changesCount === 1 ? '1 cambio sin guardar' : `${changesCount} cambios sin guardar`
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isPending || changesCount === 0}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || changesCount === 0}
            aria-busy={isPending}
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </StickyActionBar>
      </Can>
    </div>
  );
}
