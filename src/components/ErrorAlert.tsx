interface ErrorAlertProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorAlert({
  message,
  title = 'Something went wrong',
  onRetry,
  onDismiss,
}: ErrorAlertProps) {
  if (!message) return null;

  const canRetry = typeof onRetry === 'function';
  const canDismiss = typeof onDismiss === 'function';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="animate-in slide-in-from-top-2 fade-in fixed top-4 right-4 left-4 z-50 duration-300 md:left-auto md:w-96"
    >
      <div
        className="rounded-xl border p-4 shadow-xl backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.15)',
          borderColor: '#991b1b',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Error Icon */}
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6"
              style={{ color: '#fca5a5' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-sm font-semibold" style={{ color: '#fca5a5' }}>
              {title}
            </h3>
            <p className="text-sm" style={{ color: '#fecaca' }}>
              {message}
            </p>

            {/* Actions */}
            {(canRetry || canDismiss) && (
              <div className="mt-3 flex gap-2">
                {canRetry ? (
                  <button
                    onClick={onRetry}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    style={{
                      backgroundColor: '#f1c40f',
                      color: '#0a1628',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f7dc6f';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1c40f';
                    }}
                  >
                    Try again
                  </button>
                ) : null}
                {canDismiss ? (
                  <button
                    onClick={onDismiss}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    style={{ color: '#fca5a5' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fecaca';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#fca5a5';
                    }}
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Close button */}
          {canDismiss ? (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
              style={{ color: '#fca5a5' }}
              aria-label="Close alert"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fecaca';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#fca5a5';
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
