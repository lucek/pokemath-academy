import pokeballSprite from '@/assets/icons/pokeball.png?url';
import { cn } from '@/lib/utils';

type AttemptsIndicatorSize = 'sm' | 'md';

interface AttemptsIndicatorProps {
  readonly attemptsRemaining: number;
  readonly totalAttempts: number;
  readonly label?: string;
  readonly className?: string;
  readonly size?: AttemptsIndicatorSize;
  readonly orientation?: 'vertical' | 'horizontal';
  readonly showLabel?: boolean;
}

const SIZE_CLASS_MAP: Record<
  AttemptsIndicatorSize,
  { container: string; image: string; gap: string; label: string }
> = {
  md: { container: 'h-10 w-10', image: 'h-6 w-6', gap: 'gap-2', label: 'text-xs' },
  sm: { container: 'h-8 w-8', image: 'h-5 w-5', gap: 'gap-1.5', label: 'text-[0.65rem]' },
};

export function AttemptsIndicator({
  attemptsRemaining,
  totalAttempts,
  label = 'Attempts',
  className,
  size = 'md',
  orientation = 'vertical',
  showLabel = true,
}: AttemptsIndicatorProps) {
  const { container, image, gap, label: labelSize } = SIZE_CLASS_MAP[size];
  const baseLayout =
    orientation === 'vertical'
      ? 'flex flex-col gap-1.5 text-white/80'
      : 'flex flex-row items-center gap-2 text-white/80';
  return (
    <div className={cn(baseLayout, className)}>
      {showLabel && (
        <span className={cn('font-semibold tracking-[0.3em] text-white/60 uppercase', labelSize)}>
          {label}
        </span>
      )}
      <div className={cn('flex items-center', gap)}>
        {Array.from({ length: totalAttempts }, (_, index) => {
          const isActive = index < attemptsRemaining;
          return (
            <div
              key={`attempt-${index}`}
              className={cn(
                'flex items-center justify-center transition-opacity',
                container,
                isActive ? 'opacity-100' : 'opacity-30',
              )}
            >
              <img
                src={pokeballSprite}
                alt="Pokeball attempt indicator"
                className={cn(image, isActive ? '' : 'grayscale')}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
