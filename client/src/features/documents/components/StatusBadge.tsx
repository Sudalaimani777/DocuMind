import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '../../../core/lib/utils';

interface StatusConfig {
  label: string;
  pillClass: string;
  Icon: typeof CheckCircle2;
  spin?: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  completed: {
    label: 'Ready',
    pillClass: 'bg-status-ready-bg text-status-ready-text border-status-ready-border',
    Icon: CheckCircle2,
  },
  processing: {
    label: 'Processing',
    pillClass:
      'bg-status-processing-bg text-status-processing-text border-status-processing-border',
    Icon: Loader2,
    spin: true,
  },
  pending: {
    label: 'Queued',
    pillClass: 'bg-status-queued-bg text-status-queued-text border-status-queued-border',
    Icon: Clock,
  },
  failed: {
    label: 'Failed',
    pillClass: 'bg-status-failed-bg text-status-failed-text border-status-failed-border',
    Icon: AlertCircle,
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status.toLowerCase()] ?? STATUS_MAP.pending;
  const Icon = cfg.Icon;

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border font-t05 text-t05',
        cfg.pillClass
      )}
    >
      <Icon
        className={cn('w-3 h-3', cfg.spin ? 'animate-spin' : undefined)}
        aria-hidden="true"
      />
      <span>{cfg.label}</span>
    </span>
  );
}
