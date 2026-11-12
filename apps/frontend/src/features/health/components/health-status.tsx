import React from 'react';
import type { HealthStatusProps } from '../types';

export const HealthStatus: React.FC<HealthStatusProps> = ({
  status,
  message,
  uptime,
  timestamp,
}) => {
  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center space-x-2 text-label text-muted-foreground"
      >
        <span
          className="inline-block size-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700"
          aria-hidden="true"
        />
        <span>Comprobando estado del servidor...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border border-danger-border bg-danger-soft p-4 text-label text-danger"
      >
        <div className="flex items-center space-x-2 font-medium">
          <span className="inline-block size-2.5 rounded-full bg-danger" aria-hidden="true" />
          <span>Servidor no disponible o con errores</span>
        </div>
        {message && <p className="mt-1 text-meta text-danger">{message}</p>}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-success-border bg-success-soft p-4 text-label text-success"
    >
      <div className="flex items-center space-x-2 font-medium">
        <span className="inline-block size-2.5 rounded-full bg-success" aria-hidden="true" />
        <span>Servidor operativo (OK)</span>
      </div>
      {message && <p className="mt-1 text-meta text-success">{message}</p>}
      {uptime !== undefined && (
        <p className="mt-1 text-meta text-success">Tiempo activo: {Math.floor(uptime)}s</p>
      )}
      {timestamp && <p className="text-meta text-success">Última comprobación: {timestamp}</p>}
    </div>
  );
};
