import { useCallback, useEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown, X } from 'lucide-react';
import { z } from 'zod';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isNavItemActive } from '@/lib/nav-filter';
import { NAV_GROUPS, type NavGroup, type NavItem } from './nav-items';
import { useNavGroups } from './use-nav-groups';

export const NAV_OPEN_GROUPS_STORAGE_KEY = 'sigoa.nav.open-groups';

const openGroupsSchema = z.array(z.string().max(40)).max(20);

function readStoredOpenGroups(): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(NAV_OPEN_GROUPS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = openGroupsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeStoredOpenGroups(ids: readonly string[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(NAV_OPEN_GROUPS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Almacenamiento bloqueado o lleno: se ignora sin error.
  }
}

function findActiveGroupIds(groups: readonly NavGroup[], currentPath: string): string[] {
  return groups
    .filter((group) => group.items.some((item) => isNavItemActive(currentPath, item)))
    .map((group) => group.id);
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  groups?: readonly NavGroup[];
}

interface SidebarLinkProps {
  item: NavItem;
  isActive: boolean;
  onClose: () => void;
}

function SidebarLink({ item, isActive, onClose }: SidebarLinkProps) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-label font-medium transition-colors motion-color ${
        isActive
          ? 'bg-sidebar-active text-sidebar-active-foreground font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-brand-700'
          : 'text-sidebar-foreground hover:bg-brand-50'
      }`}
    >
      {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
      <span>{item.title}</span>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose, groups = NAV_GROUPS }: SidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const resolvedGroups = useNavGroups(groups);

  const [openGroupIds, setOpenGroupIds] = useState<string[]>(() => {
    const stored = readStoredOpenGroups();
    const activeIds = findActiveGroupIds(groups, currentPath);
    return Array.from(new Set([...stored, ...activeIds]));
  });
  const [trackedPath, setTrackedPath] = useState(currentPath);

  if (trackedPath !== currentPath) {
    setTrackedPath(currentPath);
    const activeIds = findActiveGroupIds(groups, currentPath);
    const missing = activeIds.filter((id) => !openGroupIds.includes(id));
    if (missing.length > 0) {
      setOpenGroupIds([...openGroupIds, ...missing]);
    }
  }

  useEffect(() => {
    if (openGroupIds.length > 0) {
      writeStoredOpenGroups(openGroupIds);
    }
  }, [openGroupIds]);

  const setGroupOpen = useCallback((groupId: string, open: boolean) => {
    setOpenGroupIds((prev) => {
      const next = open
        ? prev.includes(groupId)
          ? prev
          : [...prev, groupId]
        : prev.filter((id) => id !== groupId);
      writeStoredOpenGroups(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        const toggleButton = document.querySelector<HTMLButtonElement>(
          'button[aria-controls="app-sidebar"]',
        );
        toggleButton?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop para pantallas menores a 1024px */}
      {isOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 top-16 z-40 bg-brand-950/60 transition-opacity lg:hidden"
        />
      )}

      {/* Barra lateral */}
      <aside
        id="app-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-[45] flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-standard lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100dvh-4rem)] lg:self-start lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Barra lateral de navegación"
      >
        {isOpen && (
          <div className="flex items-center justify-between border-b border-border p-4 lg:hidden">
            <span className="text-meta font-bold uppercase tracking-wider text-muted-foreground">
              Navegación
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar barra lateral"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-brand-50"
            >
              <span className="sr-only">Cerrar barra lateral</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4" aria-label="Navegación principal">
          <ul className="space-y-2">
            {resolvedGroups.map(({ group, items, isLoading }) => {
              if (isLoading) {
                return (
                  <li key={group.id} data-testid={`sidebar-group-skeleton-${group.id}`}>
                    <div className="px-3 py-2 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                    </div>
                    <div aria-hidden="true" className="space-y-1.5 pl-3">
                      <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
                      <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
                    </div>
                  </li>
                );
              }

              const isDirectLink =
                group.items.length === 1 && !group.items[0]?.permission && items.length === 1;

              if (isDirectLink) {
                const directItem = items[0]!;
                return (
                  <li key={group.id}>
                    <SidebarLink
                      item={directItem}
                      isActive={isNavItemActive(currentPath, directItem)}
                      onClose={onClose}
                    />
                  </li>
                );
              }

              const GroupIcon = group.icon;
              const isGroupOpen = openGroupIds.includes(group.id);

              return (
                <li key={group.id}>
                  <Collapsible
                    open={isGroupOpen}
                    onOpenChange={(open) => setGroupOpen(group.id, open)}
                  >
                    <CollapsibleTrigger
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-label font-semibold text-sidebar-foreground transition-colors motion-color hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&[data-state=open]>svg.nav-chevron]:rotate-180"
                    >
                      <span className="flex items-center gap-3">
                        <GroupIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span>{group.title}</span>
                      </span>
                      <ChevronDown
                        className="nav-chevron size-4 shrink-0 text-muted-foreground transition-transform motion-color"
                        aria-hidden="true"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-1 space-y-1 pl-3">
                        {items.map((item) => (
                          <li key={item.href}>
                            <SidebarLink
                              item={item}
                              isActive={isNavItemActive(currentPath, item)}
                              onClose={onClose}
                            />
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-4 text-meta text-muted-foreground">
          <p className="font-semibold text-foreground">UNTRM · EPIS</p>
          <p className="mt-0.5 text-meta text-muted-foreground">Versión 0.1.0</p>
        </div>
      </aside>
    </>
  );
}
