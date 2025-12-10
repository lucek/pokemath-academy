import type { PokemonCaptureStatusDto } from '@/types';

const VARIANT_LABELS: Record<'normal' | 'shiny', string> = {
  normal: 'Normal',
  shiny: 'Shiny',
};

interface CaptureStatusProps {
  readonly status?: PokemonCaptureStatusDto;
}

function formatCapturedDate(date: string | null): string {
  if (!date) return 'Unknown date';
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return formatter.format(new Date(date));
}

export function CaptureStatus({ status }: CaptureStatusProps) {
  if (!status) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 px-4 py-5 sm:px-6">
        <h3 className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
          Capture status
        </h3>
        <p className="mt-2 text-sm text-white/70">Capture information is unavailable right now.</p>
      </section>
    );
  }

  const ownedMap = status.owned.reduce<
    Record<'normal' | 'shiny', { capturedAt: string | null } | undefined>
  >(
    (acc, entry) => {
      acc[entry.variant] = { capturedAt: entry.capturedAt };
      return acc;
    },
    { normal: undefined, shiny: undefined },
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 text-white sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
            Capture status
          </h3>
          <p className="mt-1 text-lg font-semibold">
            {status.isBaseCaught ? 'Caught' : 'Not caught yet'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(['normal', 'shiny'] as const).map((variant) => {
          const owned = ownedMap[variant];
          return (
            <div
              key={variant}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3"
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="tracking-[0.2em] text-white/60 uppercase">
                  {VARIANT_LABELS[variant]}
                </span>
                {owned ? (
                  <span className="text-xs text-emerald-300">Owned</span>
                ) : (
                  <span className="text-xs text-white/50">Missing</span>
                )}
              </div>
              <p className="mt-2 text-sm text-white/80">
                {owned
                  ? `Captured on ${formatCapturedDate(owned.capturedAt)}`
                  : 'Capture this variant to unlock rewards'}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
