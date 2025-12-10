import { useEffect, type ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ToastMessage, ToastType } from './types';

interface ToastProps {
  readonly toast: ToastMessage;
  readonly onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ROLE: Record<ToastType, 'status' | 'alert'> = {
  success: 'status',
  info: 'status',
  warning: 'alert',
  error: 'alert',
};

const VARIANTS: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-50',
  error: 'border-red-500/40 bg-red-500/10 text-red-50',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-50',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-50',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    const timer: ReturnType<typeof setTimeout> | undefined =
      typeof globalThis.setTimeout === 'function'
        ? globalThis.setTimeout(() => onDismiss(toast.id), duration)
        : undefined;
    return () => {
      if (timer !== undefined) {
        globalThis.clearTimeout?.(timer);
      }
    };
  }, [toast, onDismiss, duration]);

  const Icon = ICONS[toast.type];

  return (
    <div
      role={ROLE[toast.type]}
      aria-live={ROLE[toast.type] === 'alert' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto w-full max-w-[360px] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-lg',
        'bg-background/95 text-foreground dark:bg-neutral-900/90',
        VARIANTS[toast.type],
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm leading-5 font-medium text-white/90">{toast.message}</p>
        <button
          type="button"
          className="focus-visible:ring-ring/60 rounded-full p-1 text-white/60 transition hover:text-white focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
