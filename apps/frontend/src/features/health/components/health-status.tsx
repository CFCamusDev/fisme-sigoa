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
        className="flex items-center space-x-2 text-sm text-neutral-600"
      >
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-800"
          aria-hidden="true"
        />
        <span>Comprobando estado del servidor...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        <div className="flex items-center space-x-2 font-medium">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />
          <span>Servidor no disponible o con errores</span>
        </div>
        {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800"
    >
      <div className="flex items-center space-x-2 font-medium">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" aria-hidden="true" />
        <span>Servidor operativo (OK)</span>
      </div>
      {uptime !== undefined && (
        <p className="mt-1 text-xs text-green-700">Tiempo activo: {Math.floor(uptime)}s</p>
      )}
      {timestamp && <p className="text-xs text-green-700">Última comprobación: {timestamp}</p>}
    </div>
  );
};
