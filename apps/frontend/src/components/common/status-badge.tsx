import {
  Circle,
  Clock,
  TriangleAlert,
  CircleCheck,
  CircleX,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import {
  BADGE_BASE,
  getStatusDescriptor,
  type StatusKey,
  type StatusTone,
  TONE_CLASSES,
} from '@/lib/status';
import { cn } from '@/lib/utils';

const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  neutral: Circle,
  info: Clock,
  warning: TriangleAlert,
  success: CircleCheck,
  danger: CircleX,
  closed: Lock,
};

export interface StatusBadgeProps {
  status: StatusKey;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const descriptor = getStatusDescriptor(status);
  const displayLabel = label ?? descriptor.label;
  const Icon = TONE_ICONS[descriptor.tone];

  return (
    <span className={cn(BADGE_BASE, TONE_CLASSES[descriptor.tone], className)}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
