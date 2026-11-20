import { Link } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import type { PresidentRoleAlertDto } from '@sigoa/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePermission } from '@/hooks/use-permission';

export interface PresidentAlertsProps {
  readonly alerts: readonly PresidentRoleAlertDto[];
}

export function PresidentAlerts({ alerts }: PresidentAlertsProps) {
  const { allowed } = usePermission('usuario.editar');

  if (!allowed || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" aria-label="Alertas de rol Presidente">
      {alerts.map((alert) => (
        <Alert key={alert.userId} variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Revisión de rol Presidente pendiente</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {alert.fullName} tiene el rol Presidente pero no es el Presidente vigente del Comité.
              Retira el rol en Usuarios.
            </span>
            <Link
              to="/usuarios"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir a Usuarios
            </Link>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
