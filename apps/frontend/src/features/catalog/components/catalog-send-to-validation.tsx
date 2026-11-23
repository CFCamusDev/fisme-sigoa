import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSendCatalogVersionToValidation } from '../hooks/use-send-catalog-version-to-validation';
import { getCatalogEditErrorMessage } from '../lib/catalog-error-message';

export interface CatalogSendToValidationProps {
  readonly versionId: string;
  readonly objectiveCount: number;
  readonly attributeCount: number;
}

/**
 * Acción «Enviar a validación» de una versión en Borrador (HU-015, RF-015). Muestra las
 * precondiciones con ícono y texto, deshabilita el envío si alguna no se cumple y pide una
 * confirmación en línea. El servidor revalida todo.
 */
export function CatalogSendToValidation({
  versionId,
  objectiveCount,
  attributeCount,
}: CatalogSendToValidationProps) {
  const send = useSendCatalogVersionToValidation(versionId);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const preconditions = [
    { id: 'objectives', label: 'Al menos un objetivo educacional', met: objectiveCount >= 1 },
    { id: 'attributes', label: 'Al menos un atributo del graduado', met: attributeCount >= 1 },
  ];
  const ready = preconditions.every((precondition) => precondition.met);

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    }
  }, [confirming]);

  const pending = send.isPending;
  useEffect(() => {
    if (!confirming || pending) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirming(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming, pending]);

  async function handleConfirm() {
    setErrorMessage(null);
    try {
      await send.mutateAsync();
    } catch (error) {
      setConfirming(false);
      setErrorMessage(getCatalogEditErrorMessage(error));
    }
  }

  return (
    <section
      aria-labelledby="catalog-send-validation-title"
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="catalog-send-validation-title" className="text-base font-semibold text-foreground">
          Enviar a validación
        </h2>
        <p className="text-sm text-muted-foreground">
          Al enviarla, la versión queda disponible para las encuestas de validación y sus textos
          dejan de poder editarse.
        </p>
      </div>

      <ul aria-label="Precondiciones para el envío" className="space-y-2">
        {preconditions.map((precondition) => (
          <li key={precondition.id} className="flex items-center gap-2 text-sm text-foreground">
            {precondition.met ? (
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            <span>
              {precondition.label}{' '}
              <span className="text-muted-foreground">
                {precondition.met ? '(cumplida)' : '(pendiente)'}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {errorMessage && (
        <Alert variant="danger">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {confirming ? (
        <div role="group" aria-label="Confirmar el envío" className="space-y-3">
          <p className="text-sm text-foreground">
            ¿Enviar esta versión a validación? Los textos quedarán bloqueados.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={confirmRef}
              type="button"
              onClick={() => void handleConfirm()}
              disabled={send.isPending}
            >
              <Send aria-hidden="true" />
              Confirmar envío
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={send.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setConfirming(true);
          }}
          disabled={!ready || send.isPending}
        >
          <Send aria-hidden="true" />
          Enviar a validación
        </Button>
      )}
    </section>
  );
}
