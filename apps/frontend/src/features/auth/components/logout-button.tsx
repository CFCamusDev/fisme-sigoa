import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLogout } from '../hooks/use-logout';

export interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps = {}) {
  const { isAuthenticated, user } = useAuth();
  const { mutate: logout, isPending } = useLogout();

  if (!isAuthenticated) {
    return null;
  }

  const label = isPending ? 'Cerrando sesión…' : 'Cerrar sesión';

  return (
    <div className="flex items-center gap-3">
      {user && (
        <span className="hidden md:inline-block text-meta text-brand-100 font-medium">
          {user.names} {user.firstSurname}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        aria-busy={isPending}
        aria-label={label}
        onClick={() => logout()}
        className={`text-topbar-foreground hover:bg-brand-800/80 hover:text-topbar-foreground focus-ring ${className ?? ''}`}
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:inline-block">{label}</span>
      </Button>
    </div>
  );
}
