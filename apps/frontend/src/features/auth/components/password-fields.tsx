import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PasswordConfirmationFormData } from '../schemas/password-confirmation-schema';

export interface PasswordFieldsProps {
  idPrefix: string;
  register: UseFormRegister<PasswordConfirmationFormData>;
  errors: FieldErrors<PasswordConfirmationFormData>;
  disabled?: boolean;
}

export function PasswordFields({ idPrefix, register, errors, disabled }: PasswordFieldsProps) {
  // Extrae todos los mensajes de error de la política para criteriaMode: 'all'
  const passwordErrorMessages: string[] = [];
  if (errors.password) {
    if (errors.password.types) {
      for (const val of Object.values(errors.password.types)) {
        if (Array.isArray(val)) {
          passwordErrorMessages.push(...val.filter((m): m is string => typeof m === 'string'));
        } else if (typeof val === 'string') {
          passwordErrorMessages.push(val);
        }
      }
    } else if (errors.password.message) {
      passwordErrorMessages.push(errors.password.message);
    }
  }

  const passwordId = `${idPrefix}-password`;
  const passwordHintId = `${idPrefix}-password-hint`;
  const passwordErrorsId = `${idPrefix}-password-errors`;
  const confirmPasswordId = `${idPrefix}-confirm-password`;
  const confirmErrorId = `${idPrefix}-confirm-error`;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={passwordId}>
          Nueva contraseña{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••••"
          disabled={disabled}
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={
            errors.password ? `${passwordHintId} ${passwordErrorsId}` : passwordHintId
          }
          {...register('password')}
        />
        <p id={passwordHintId} className="text-meta text-muted-foreground">
          Mínimo 10 caracteres, con letras y números.
        </p>
        {passwordErrorMessages.length > 0 && (
          <ul id={passwordErrorsId} className="space-y-1 text-meta text-destructive" role="alert">
            {passwordErrorMessages.map((msg, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={confirmPasswordId}>
          Confirmar contraseña{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
          <span className="sr-only">obligatorio</span>
        </Label>
        <Input
          id={confirmPasswordId}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••••"
          disabled={disabled}
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          aria-describedby={errors.confirmPassword ? confirmErrorId : undefined}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p id={confirmErrorId} className="text-meta text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
    </>
  );
}
