import { ChevronDown, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '../hooks/use-logout';

function getInitials(names: string, firstSurname: string): string {
  const first = names.trim().charAt(0).toUpperCase();
  const second = firstSurname.trim().charAt(0).toUpperCase();
  return `${first}${second}` || 'U';
}

export function UserMenu() {
  const { isAuthenticated, user } = useAuth();
  const { mutate: logout, isPending } = useLogout();

  if (!isAuthenticated) {
    return null;
  }

  const fullName = user ? `${user.names} ${user.firstSurname}`.trim() : 'Usuario';
  const initials = user ? getInitials(user.names, user.firstSurname) : 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menú de usuario de ${fullName}`}
          className="inline-flex items-center gap-2 rounded-full bg-brand-800/60 px-3 py-1.5 text-meta font-medium text-brand-100 transition-colors motion-color hover:bg-brand-800 focus-ring"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-6 items-center justify-center rounded-full bg-brand-700 text-meta font-semibold text-primary-foreground"
          >
            {initials}
          </span>
          <span className="hidden md:inline-block">{fullName}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{fullName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          aria-busy={isPending}
          onSelect={(event) => {
            event.preventDefault();
            if (isPending) {
              return;
            }
            logout();
          }}
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          <span>{isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
