import type { TemplateVariableDto } from '@sigoa/shared';
import { Button } from '@/components/ui/button';

export interface TemplateVariablesPanelProps {
  readonly variables: readonly TemplateVariableDto[];
  /** Sin función de inserción (solo lectura) las variables se listan sin botón. */
  readonly onInsert?: (key: string) => void;
}

export function TemplateVariablesPanel({ variables, onInsert }: TemplateVariablesPanelProps) {
  return (
    <section
      aria-labelledby="template-variables-title"
      className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h3 id="template-variables-title" className="text-base font-semibold text-foreground">
          Variables disponibles
        </h3>
        <p className="text-sm text-foreground">
          {onInsert
            ? 'Inserta una variable en la posición del cursor. Solo se admiten estas.'
            : 'Variables que el contenido de esta plantilla puede usar.'}
        </p>
      </div>

      {variables.length === 0 ? (
        <p className="text-sm text-foreground">Esta plantilla no declara variables.</p>
      ) : (
        <ul className="space-y-2">
          {variables.map((variable) => (
            <li key={variable.key} className="space-y-1">
              <p className="text-sm text-foreground">{variable.label}</p>
              {onInsert ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono"
                  aria-label={`Insertar {{${variable.key}}}`}
                  onClick={() => onInsert(variable.key)}
                >
                  {`{{${variable.key}}}`}
                </Button>
              ) : (
                <code className="block text-sm text-foreground">{`{{${variable.key}}}`}</code>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
