import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly onReset?: () => void;
  readonly fallbackTitle?: string;
  readonly fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error', error, info);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  private readonly handleReload = () => {
    globalThis.location?.reload?.();
  };

  override render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? 'Something went wrong';
      const message =
        this.props.fallbackMessage ??
        'We hit an unexpected issue. Please reload the page or try again in a moment.';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            'flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-red-500/40',
            'bg-gradient-to-b from-red-950/80 via-slate-950/90 to-slate-950/95 p-8 text-center text-slate-100',
            'shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
            this.props.className,
          )}
        >
          <AlertTriangle className="mb-4 size-10 text-amber-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-300">{message}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.handleReload} className="min-w-[140px]">
              Reload Page
            </Button>
            {this.props.onReset && (
              <Button variant="outline" onClick={this.handleReset} className="min-w-[140px]">
                Try again
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
