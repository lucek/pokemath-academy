import { useId, useMemo } from 'react';
import type { PokemonTypeDto } from '@/types';
import { buildWavePalette, type WavePalette } from '@/lib/type-colors';
import { cn } from '@/lib/utils';

interface WaveSettings {
  readonly lines: number;
  readonly amplitude: number;
  readonly wavelength: number;
  readonly verticalPadding: number;
  readonly opacityStart: number;
  readonly opacityEnd: number;
}

type WaveVariant = 'card' | 'modal';

const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;

const VARIANT_SETTINGS: Record<WaveVariant, WaveSettings> = {
  card: {
    lines: 12,
    amplitude: 26,
    wavelength: 220,
    verticalPadding: 90,
    opacityStart: 0.18,
    opacityEnd: 0.5,
  },
  modal: {
    lines: 16,
    amplitude: 34,
    wavelength: 240,
    verticalPadding: 70,
    opacityStart: 0.16,
    opacityEnd: 0.55,
  },
};

const interpolateHex = (start: string, end: string, steps: number): string[] => {
  if (steps <= 1) return [start];
  const startRgb = hexToRgb(start);
  const endRgb = hexToRgb(end);

  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1);
    const r = Math.round(startRgb[0] + (endRgb[0] - startRgb[0]) * ratio);
    const g = Math.round(startRgb[1] + (endRgb[1] - startRgb[1]) * ratio);
    const b = Math.round(startRgb[2] + (endRgb[2] - startRgb[2]) * ratio);
    return rgbToHex(r, g, b);
  });
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const bigint = Number.parseInt(value, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const value = [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('');
  return `#${value}`;
};

const waveHash = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildWavePath = (
  baselineY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
): string => {
  const startX = -wavelength + phase;
  const endX = BASE_WIDTH + wavelength;
  let currentX = startX;
  let direction = 1;

  let d = `M ${startX} ${BASE_HEIGHT} L ${startX} ${baselineY}`;

  while (currentX < endX) {
    const controlX = currentX + wavelength / 2;
    const endSegmentX = currentX + wavelength;
    d += ` Q ${controlX} ${baselineY + direction * amplitude} ${endSegmentX} ${baselineY}`;
    currentX = endSegmentX;
    direction *= -1;
  }

  d += ` L ${currentX} ${BASE_HEIGHT} L ${startX} ${BASE_HEIGHT} Z`;
  return d;
};

const generateWavePaths = (seed: string, palette: WavePalette, settings: WaveSettings) => {
  const spacing =
    settings.lines === 1 ? 0 : (BASE_HEIGHT - settings.verticalPadding * 2) / (settings.lines - 1);
  const colorRamp = interpolateHex(palette.start, palette.end, settings.lines);
  const baseOpacityStep =
    settings.lines === 1 ? 0 : (settings.opacityEnd - settings.opacityStart) / (settings.lines - 1);
  const phase = waveHash(seed) % settings.wavelength;

  return Array.from({ length: settings.lines }, (_, index) => {
    const baseline = settings.verticalPadding + spacing * index;
    const color = colorRamp[index] ?? palette.end;
    const opacity = settings.opacityStart + baseOpacityStep * index;
    const d = buildWavePath(
      baseline,
      settings.amplitude,
      settings.wavelength,
      (phase + index * 12) % settings.wavelength,
    );
    return { d, color, opacity };
  });
};

interface TypeWaveBackgroundProps {
  readonly types: PokemonTypeDto[];
  readonly variant?: WaveVariant;
  readonly className?: string;
}

export function TypeWaveBackground({
  types,
  variant = 'card',
  className,
}: TypeWaveBackgroundProps) {
  const palette = useMemo(() => buildWavePalette(types), [types]);
  const seed = useMemo(
    () => (types.length > 0 ? types.map((type) => type.name).join('-') : 'default'),
    [types],
  );
  const waveSettings = VARIANT_SETTINGS[variant];
  const paths = useMemo(
    () => generateWavePaths(seed, palette, waveSettings),
    [seed, palette, waveSettings],
  );
  const id = useId();

  return (
    <svg
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
      role="presentation"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={palette.background} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100%" height="100%" fill={palette.background} opacity="0.7" />
      <rect width="100%" height="100%" fill={`url(#${id}-glow)`} />

      {paths.map((path, index) => (
        <path key={`${id}-wave-${index}`} d={path.d} fill={path.color} fillOpacity={path.opacity} />
      ))}

      <rect width="100%" height="100%" fill={palette.accent} opacity="0.08" />
    </svg>
  );
}
