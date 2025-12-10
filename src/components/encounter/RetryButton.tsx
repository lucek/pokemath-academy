import { type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RetryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function RetryButton({ onClick, disabled, className, style }: RetryButtonProps) {
  return (
    <Button
      variant="default"
      onClick={onClick}
      disabled={disabled}
      className={cn('h-12 text-base font-semibold sm:h-14', className)}
      style={style}
    >
      Retry
    </Button>
  );
}
