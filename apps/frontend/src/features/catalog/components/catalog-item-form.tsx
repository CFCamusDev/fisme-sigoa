import { useEffect, useId, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import {
  saveCatalogAttributeRequestSchema,
  saveCatalogObjectiveRequestSchema,
} from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CatalogItemKind } from '../api/reorder-catalog-items';
import { getCatalogEditErrorMessage } from '../lib/catalog-error-message';
import { hasName, type CatalogEditorItem } from '../types/catalog-editor';

const objectiveFormSchema = saveCatalogObjectiveRequestSchema.omit({ operation: true, id: true });
const attributeFormSchema = saveCatalogAttributeRequestSchema.omit({ operation: true, id: true });

export interface CatalogItemFormValues {
  code: string;
  name?: string;
  statement: string;
}

export interface CatalogItemFormProps {
  readonly kind: CatalogItemKind;
  /** Con elemento es una edición; sin él, un alta. */
  readonly item?: CatalogEditorItem;
  readonly submitting: boolean;
  /** Debe lanzar el error de la API si falla el guardado. */
  readonly onSubmit: (values: CatalogItemFormValues) => Promise<void>;
  readonly onCancel: () => void;
}

export function CatalogItemForm({
  kind,
  item,
  submitting,
  onSubmit,
  onCancel,
}: CatalogItemFormProps) {
  const uid = useId();
  const isAttribute = kind === 'ATTRIBUTES';
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CatalogItemFormValues>({
    // El esquema de cada tipo es el compartido con el servidor; solo se unifica el tipo del formulario.
    resolver: zodResolver(
      isAttribute ? attributeFormSchema : objectiveFormSchema,
    ) as unknown as Resolver<CatalogItemFormValues>,
    defaultValues: {
      code: item?.code ?? '',
      name: item && hasName(item) ? item.name : '',
      statement: item?.statement ?? '',
    },
  });

  useEffect(() => {
    setFocus('code');
  }, [setFocus]);

  useEffect(() => {
    if (formError) {
      alertRef.current?.focus();
    }
  }, [formError]);

  async function submit(values: CatalogItemFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const message = getCatalogEditErrorMessage(error);
      if ((error as { status?: number }).status === 409 && /código/i.test(message)) {
        setError('code', { type: 'server', message });
        setFocus('code');
      } else {
        setFormError(message);
      }
    }
  }

  const codeId = `${uid}-code`;
  const nameId = `${uid}-name`;
  const statementId = `${uid}-statement`;

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label={item ? `Editar ${item.code}` : 'Agregar elemento'}
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
    >
      <h3 className="text-base font-semibold text-foreground">
        {item ? `Editar ${item.code}` : isAttribute ? 'Nuevo atributo' : 'Nuevo objetivo'}
      </h3>

      {formError && (
        <div ref={alertRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant="danger">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={codeId}>Código</Label>
        <Input
          id={codeId}
          {...register('code')}
          disabled={submitting}
          aria-invalid={errors.code ? 'true' : 'false'}
          aria-describedby={errors.code ? `${codeId}-error` : undefined}
        />
        {errors.code && (
          <p
            id={`${codeId}-error`}
            role="alert"
            className="text-body-sm font-medium text-destructive"
          >
            {errors.code.message}
          </p>
        )}
      </div>

      {isAttribute && (
        <div className="space-y-2">
          <Label htmlFor={nameId}>Nombre</Label>
          <Input
            id={nameId}
            {...register('name')}
            disabled={submitting}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
          />
          {errors.name && (
            <p
              id={`${nameId}-error`}
              role="alert"
              className="text-body-sm font-medium text-destructive"
            >
              {errors.name.message}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={statementId}>Enunciado</Label>
        <Textarea
          id={statementId}
          rows={4}
          {...register('statement')}
          disabled={submitting}
          aria-invalid={errors.statement ? 'true' : 'false'}
          aria-describedby={errors.statement ? `${statementId}-error` : undefined}
        />
        {errors.statement && (
          <p
            id={`${statementId}-error`}
            role="alert"
            className="text-body-sm font-medium text-destructive"
          >
            {errors.statement.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
