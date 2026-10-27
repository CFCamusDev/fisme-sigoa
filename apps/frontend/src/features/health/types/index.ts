export type HealthStatusState = 'loading' | 'ok' | 'error';

export interface HealthStatusProps {
  status: HealthStatusState;
  message?: string;
  uptime?: number;
  timestamp?: string;
}
