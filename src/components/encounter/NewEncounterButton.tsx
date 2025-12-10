import { type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NewEncounterButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function NewEncounterButton({
  onClick,
  disabled,
  loading,
  className,
  style,
}: NewEncounterButtonProps) {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn('h-12 text-base font-semibold sm:h-14', className)}
      style={style}
    >
      {loading ? 'Starting...' : 'Start New Encounter'}
    </Button>
  );
}
