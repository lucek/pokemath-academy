import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { QuestionViewModel } from '@/components/encounter/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: QuestionViewModel;
  disabled: boolean;
  onSelect: (selected: number) => void;
  step?: number;
  total?: number;
  accentColor?: string;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return hex;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

export function QuestionCard({
  question,
  disabled,
  onSelect,
  step,
  total = 3,
  accentColor = '#7ac74c',
}: QuestionCardProps) {
  const [pressedOption, setPressedOption] = useState<number | null>(null);
  const progressLabel = step && total ? `Question ${step} of ${total}` : null;

  useEffect(() => {
    setPressedOption(null);
  }, [question.id]);

  const handleSelect = (optionIndex1Based: number) => {
    setPressedOption(optionIndex1Based);
    onSelect(optionIndex1Based);
  };

  const buttonEffects = useMemo(() => {
    return {
      idleBorder: hexToRgba(accentColor, 0.35),
      activeBorder: hexToRgba(accentColor, 0.85),
      idleGlow: 'rgba(5, 6, 15, 0.45)',
      activeGlow: hexToRgba(accentColor, 0.45),
      idleFill: hexToRgba(accentColor, 0.12),
      activeFill: hexToRgba(accentColor, 0.25),
    };
  }, [accentColor]);

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 text-center sm:mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white drop-shadow-lg sm:text-3xl">
            {question.text}
          </h2>
          {progressLabel ? <p className="sr-only">{progressLabel}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {question.options.map((value, index) => {
            const optionIndex1Based = index + 1;
            const isPressed = pressedOption === optionIndex1Based;
            return (
              <Button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(optionIndex1Based)}
                data-test-id={`question-option-${question.id}-${optionIndex1Based}`}
                className={cn(
                  'h-14 justify-center border bg-white/5 text-lg font-semibold text-white transition-all duration-200 sm:h-16',
                  'hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(0,0,0,0.45)]',
                  'focus-visible:ring-4 focus-visible:ring-cyan-300/60',
                  isPressed ? 'scale-[1.02] ring-4 ring-cyan-300' : 'ring-0',
                )}
                style={
                  {
                    borderColor: isPressed ? buttonEffects.activeBorder : buttonEffects.idleBorder,
                    boxShadow: isPressed
                      ? `0 20px 45px ${buttonEffects.activeGlow}`
                      : `0 15px 30px ${buttonEffects.idleGlow}`,
                    backgroundImage: `linear-gradient(145deg, ${
                      isPressed ? buttonEffects.activeFill : buttonEffects.idleFill
                    }, rgba(5,6,15,0.65))`,
                  } satisfies CSSProperties
                }
                aria-label={`Answer option ${optionIndex1Based}: ${value}`}
                aria-pressed={isPressed}
              >
                {value}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
