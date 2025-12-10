import type { ReactNode } from 'react';
import pokeballSprite from '@/assets/icons/pokeball.png?url';
import { rgbaFromHex } from '@/lib/type-colors';

export interface SingleDividerVariant {
  readonly kind: 'single';
}

export interface StepsDividerVariant {
  readonly kind: 'steps';
  readonly totalSteps?: number;
  readonly currentStep: number;
  readonly highlightResult?: boolean;
}

export type DividerVariant = SingleDividerVariant | StepsDividerVariant;

export interface PokemonModalDividerProps {
  readonly accentColor: string;
  readonly variant: DividerVariant;
}

interface GlowConfig {
  readonly line: number;
  readonly radial: number;
  readonly linear: number;
  readonly top: number;
}

function getGlowConfig(variant: DividerVariant): GlowConfig {
  if (variant.kind === 'steps' && variant.highlightResult) {
    return { line: 1, radial: 0.85, linear: 0.85, top: 0.7 };
  }
  if (variant.kind === 'single') {
    return { line: 0.98, radial: 0.75, linear: 0.65, top: 0.45 };
  }
  return { line: 0.98, radial: 0.65, linear: 0.75, top: 0.45 };
}

function renderSingle(accentColor: string): ReactNode {
  return (
    <div className="relative flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 backdrop-blur-lg">
      <div className="absolute inset-0 rounded-full bg-white/15 opacity-25 blur-3xl" aria-hidden />
      <div
        className="relative flex h-10 w-10 items-center justify-center rounded-full border bg-[#080915]/70"
        style={{
          borderColor: rgbaFromHex(accentColor, 0.9),
          boxShadow: `0 0 35px ${rgbaFromHex(accentColor, 0.6)}`,
        }}
      >
        <div className="absolute inset-0 rounded-full bg-white/15 opacity-80 blur-xl" aria-hidden />
        <img
          src={pokeballSprite}
          alt=""
          aria-hidden
          className="relative h-7 w-7 opacity-100 drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)] transition duration-300"
          draggable={false}
        />
      </div>
    </div>
  );
}

function renderSteps(accentColor: string, variant: StepsDividerVariant): ReactNode {
  const totalSteps = variant.totalSteps ?? 3;
  return (
    <div className="relative flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 backdrop-blur-lg">
      <div className="absolute inset-0 rounded-full bg-white/15 opacity-25 blur-3xl" aria-hidden />
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === variant.currentStep;
        const isCompleted = stepNumber < variant.currentStep;
        const borderColor = variant.highlightResult
          ? rgbaFromHex(accentColor, 0.9)
          : rgbaFromHex(accentColor, isActive ? 0.9 : isCompleted ? 0.5 : 0.25);
        const boxShadow = variant.highlightResult
          ? `0 0 40px ${rgbaFromHex(accentColor, 0.7)}`
          : isActive
            ? `0 0 35px ${rgbaFromHex(accentColor, 0.65)}`
            : isCompleted
              ? `0 0 20px ${rgbaFromHex(accentColor, 0.35)}`
              : `0 0 12px ${rgbaFromHex(accentColor, 0.2)}`;
        const backgroundClass = variant.highlightResult
          ? 'blur-xl'
          : isActive
            ? 'bg-white/15 blur-xl'
            : isCompleted
              ? 'bg-white/10 blur-lg'
              : 'bg-white/5 blur-md';
        const pokeballClass = variant.highlightResult
          ? 'opacity-100 drop-shadow-[0_12px_22px_rgba(0,0,0,0.45)]'
          : isActive
            ? 'opacity-100 drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)]'
            : isCompleted
              ? 'opacity-70'
              : 'opacity-35 grayscale';
        return (
          <div
            key={`question-step-${stepNumber}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border bg-[#080915]/70"
            style={{ borderColor, boxShadow }}
          >
            <div
              className={`absolute inset-0 rounded-full ${backgroundClass}`}
              style={
                variant.highlightResult
                  ? { backgroundColor: rgbaFromHex(accentColor, 0.2) }
                  : undefined
              }
              aria-hidden
            />
            <img
              src={pokeballSprite}
              alt=""
              aria-hidden
              className={`relative h-7 w-7 transition duration-300 ${pokeballClass}`}
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}

export function PokemonModalDivider({ accentColor, variant }: PokemonModalDividerProps) {
  const glow = getGlowConfig(variant);
  return (
    <div className="w-full max-w-[360px] px-4 sm:max-w-[100%]">
      <div className="relative w-full">
        <div
          className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 opacity-95"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent, ${rgbaFromHex(accentColor, glow.line)}, transparent)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-1/2 h-16 -translate-y-1/2 opacity-90 blur-3xl"
          style={{
            backgroundImage: `radial-gradient(circle, ${rgbaFromHex(accentColor, glow.radial)} 0%, transparent 70%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-x-4 top-1/2 h-32 -translate-y-1/2 opacity-85 blur-[110px]"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent, ${rgbaFromHex(accentColor, glow.linear)}, transparent)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-x-10 -top-3 h-24 opacity-60 blur-[140px]"
          style={{
            backgroundImage: `radial-gradient(circle, ${rgbaFromHex(accentColor, glow.top)} 0%, transparent 65%)`,
          }}
          aria-hidden
        />
        <div className="relative flex items-center justify-center" aria-hidden>
          {variant.kind === 'single'
            ? renderSingle(accentColor)
            : renderSteps(accentColor, variant)}
        </div>
      </div>
    </div>
  );
}
