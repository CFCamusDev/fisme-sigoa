import * as React from 'react';
import type { PermissionDto, RoleGrant } from '@sigoa/shared';
import { Info, Search } from 'lucide-react';
import { StickyActionBar } from '@/components/common';
import { Can } from '@/components/common/can.js';
import { EmptyState } from '@/components/common/empty-state.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { cn } from '@/lib/utils.js';
import {
  buildDraft,
  countChanges,
  groupByModule,
  toUpdateRequest,
  type DraftScope,
  type PermissionDraft,
} from '../lib/permission-draft.js';
import { countAssigned, filterPermissions } from '../lib/permission-filter.js';
import { PermissionModuleTable } from './permission-module-table.js';

export interface UserDirectPermissionsEditorProps {
  readonly directPermissions: readonly RoleGrant[];
  readonly catalog: readonly PermissionDto[];
  readonly isSaving?: boolean;
  readonly onSave: (permissions: RoleGrant[]) => void;
  readonly onDiscard?: () => void;
  readonly className?: string;
}

function getDefaultOpenModules(
  catalog: readonly PermissionDto[],
  baseDraft: PermissionDraft,
): string[] {
  const grouped = groupByModule(catalog);
  return Object.entries(grouped)
    .filter(([, perms]) => countAssigned(baseDraft, perms) > 0)
    .map(([moduleName]) => moduleName);
}

export function UserDirectPermissionsEditor({
  directPermissions,
  catalog,
  isSaving = false,
  onSave,
  onDiscard,
  className,
}: UserDirectPermissionsEditorProps) {
  const searchInputId = React.useId();
  const baseDraft = React.useMemo(
    () => buildDraft({ permissions: [...directPermissions] }, catalog),
    [directPermissions, catalog],
  );

  const [prevBaseDraft, setPrevBaseDraft] = React.useState<PermissionDraft>(baseDraft);
  const [overrides, setOverrides] = React.useState<Record<string, DraftScope>>({});
  const [query, setQuery] = React.useState('');
  const [openModules, setOpenModules] = React.useState<string[]>(() =>
    getDefaultOpenModules(catalog, baseDraft),
  );

  if (baseDraft !== prevBaseDraft) {
    setPrevBaseDraft(baseDraft);
    setOverrides({});
  }

  const draft: PermissionDraft = React.useMemo(
    () => ({ ...baseDraft, ...overrides }),
    [baseDraft, overrides],
  );

  const changesCount = React.useMemo(() => countChanges(baseDraft, draft), [baseDraft, draft]);

  const filteredCatalog = React.useMemo(() => filterPermissions(catalog, query), [catalog, query]);
  const groupedFiltered = React.useMemo(() => groupByModule(filteredCatalog), [filteredCatalog]);
  const moduleEntries = React.useMemo(() => Object.entries(groupedFiltered), [groupedFiltered]);
  const groupedAll = React.useMemo(() => groupByModule(catalog), [catalog]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const visibleOpenModules = React.useMemo(
    () => (isSearching ? moduleEntries.map(([name]) => name) : openModules),
    [isSearching, moduleEntries, openModules],
  );

  const handleScopeChange = (permissionCode: string, scope: DraftScope) => {
    setOverrides((prev) => ({
      ...prev,
      [permissionCode]: scope,
    }));
  };

  const handleDiscard = () => {
    setOverrides({});
    onDiscard?.();
  };

  const handleSave = () => {
    if (isSaving || changesCount === 0) return;
    const body = toUpdateRequest(draft);
    onSave(body.permissions);
  };

  return (
    <div className={cn('space-y-6 pb-24', className)}>
      <Alert variant="default" className="border-border bg-card">
        <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        <AlertDescription className="text-xs text-muted-foreground">
          Los permisos del rol se muestran en la vista de permisos efectivos. Aquí asignas
          únicamente permisos específicos y directos para este usuario.
        </AlertDescription>
      </Alert>

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
            placeholder="Filtrar por código o descripción..."
            className="pl-9"
          />
        </div>
      </div>

      {moduleEntries.length === 0 && isSearching ? (
        <EmptyState
          title={`Ningún permiso coincide con “${trimmedQuery}”`}
          description="Prueba con otro término de código o descripción."
        />
      ) : (
        <Accordion
          type="multiple"
          value={visibleOpenModules}
          onValueChange={(next) => {
            if (!isSearching) {
              setOpenModules(next);
            }
          }}
        >
          {moduleEntries.map(([moduleName, permissions]) => {
            const moduleAllPermissions = groupedAll[moduleName] ?? permissions;
            const assignedCount = countAssigned(draft, moduleAllPermissions);

            return (
              <AccordionItem key={moduleName} value={moduleName}>
                <AccordionTrigger>
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{moduleName}</span>
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-meta font-semibold text-brand-700">
                      {assignedCount === 1 ? '1 asignado' : `${assignedCount} asignados`}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <PermissionModuleTable
                    moduleName={moduleName}
                    permissions={permissions}
                    baseDraft={baseDraft}
                    draft={draft}
                    disabled={isSaving}
                    onScopeChange={handleScopeChange}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Can permission="permiso.asignar">
        <StickyActionBar
          status={
            changesCount === 1 ? '1 cambio sin guardar' : `${changesCount} cambios sin guardar`
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isSaving || changesCount === 0}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || changesCount === 0}
            aria-busy={isSaving}
          >
            {isSaving ? 'Guardando…' : 'Guardar permisos directos'}
          </Button>
        </StickyActionBar>
      </Can>
    </div>
  );
}
