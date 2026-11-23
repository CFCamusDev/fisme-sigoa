import type { RefObject } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ConfirmStakeholderImportResponse } from '@sigoa/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const numberFormatter = new Intl.NumberFormat('es-PE');

export interface StakeholderImportResultProps {
  readonly result: ConfirmStakeholderImportResponse;
  readonly alertRef?: RefObject<HTMLDivElement | null>;
}

export function StakeholderImportResult({ result, alertRef }: StakeholderImportResultProps) {
  const { totals, rejectedRows } = result;

  return (
    <Alert ref={alertRef} variant="success" role="status" tabIndex={-1}>
      <CheckCircle2 className="size-4" aria-hidden="true" />
      <AlertTitle>
        Importación completada: {numberFormatter.format(totals.created)} creados,{' '}
        {numberFormatter.format(totals.reused)} reutilizados, {numberFormatter.format(totals.added)}{' '}
        agregados, {numberFormatter.format(totals.alreadyInList)} ya en la lista,{' '}
        {numberFormatter.format(totals.rejected)} rechazados.
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Los totales reflejan la validación final del servidor al confirmar.</p>
        {rejectedRows.length > 0 ? (
          <div>
            <p className="font-medium">
              Filas rechazadas ({numberFormatter.format(rejectedRows.length)}):
            </p>
            <ul className="mt-1 space-y-2 text-xs">
              {rejectedRows.map((row) => (
                <li key={row.rowNumber}>
                  <span className="font-medium">Fila {row.rowNumber}: </span>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                    {row.errors.map((error, index) => (
                      <li key={`${row.rowNumber}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
