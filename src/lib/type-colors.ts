import type { PokemonTypeDto } from '@/types';

export interface TypeColorSet {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
}

const DEFAULT_TYPE_COLORS: TypeColorSet = {
  light: '#b6c8ff',
  base: '#7384ff',
  dark: '#273572',
};

export const TYPE_COLOR_MAP: Record<string, TypeColorSet> = {
  normal: { light: '#d9dcc1', base: '#a8a77a', dark: '#676845' },
  fire: { light: '#ffb38a', base: '#ee8130', dark: '#b84804' },
  water: { light: '#a4caff', base: '#6390f0', dark: '#2d5ec9' },
  electric: { light: '#ffe88b', base: '#f7d02c', dark: '#b08d05' },
  grass: { light: '#bbf199', base: '#7ac74c', dark: '#3b6d1f' },
  ice: { light: '#c9f4f1', base: '#96d9d6', dark: '#3f8f8c' },
  fighting: { light: '#eb8d81', base: '#c22e28', dark: '#7a0900' },
  poison: { light: '#e0a3e6', base: '#a33ea1', dark: '#551558' },
  ground: { light: '#f6deb0', base: '#e2bf65', dark: '#8c6528' },
  flying: { light: '#d9cdff', base: '#a98ff3', dark: '#5c3cb6' },
  psychic: { light: '#ff9cc3', base: '#f95587', dark: '#a51544' },
  bug: { light: '#d3ef6e', base: '#a6b91a', dark: '#596303' },
  rock: { light: '#e6d9aa', base: '#b6a136', dark: '#695616' },
  ghost: { light: '#c8b1e4', base: '#735797', dark: '#36204f' },
  dragon: { light: '#c0a0ff', base: '#6f35fc', dark: '#2d119b' },
  dark: { light: '#b8ab9f', base: '#705746', dark: '#352116' },
  steel: { light: '#e1e5ff', base: '#b7b7ce', dark: '#6a6b83' },
  fairy: { light: '#ffc2db', base: '#d685ad', dark: '#8a3c5e' },
};

const WHITE = { light: '#ffffff', base: '#ffffff', dark: '#ffffff' };

export const rgbaFromHex = (hex: string, alpha: number): string => {
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

const ensureColorSet = (typeName?: string): TypeColorSet => {
  if (!typeName) return DEFAULT_TYPE_COLORS;
  return TYPE_COLOR_MAP[typeName.toLowerCase()] ?? DEFAULT_TYPE_COLORS;
};

const mixChannel = (a: number, b: number, ratio: number): number => Math.round(a + (b - a) * ratio);

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

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((channel) => {
      const clamped = Math.max(0, Math.min(255, channel));
      return clamped.toString(16).padStart(2, '0');
    })
    .join('')}`;

const mixHex = (a: string, b: string, ratio: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(mixChannel(ar, br, ratio), mixChannel(ag, bg, ratio), mixChannel(ab, bb, ratio));
};

export interface WavePalette {
  readonly start: string;
  readonly end: string;
  readonly background: string;
  readonly accent: string;
}

export const buildWavePalette = (types: PokemonTypeDto[]): WavePalette => {
  if (types.length === 0) {
    return {
      start: DEFAULT_TYPE_COLORS.light,
      end: DEFAULT_TYPE_COLORS.base,
      background: DEFAULT_TYPE_COLORS.dark,
      accent: mixHex(DEFAULT_TYPE_COLORS.base, WHITE.base, 0.35),
    };
  }

  const [first, second] = types;
  const primary = ensureColorSet(first?.name);
  const secondary = ensureColorSet(second?.name ?? first?.name);

  const start = mixHex(primary.light, primary.base, 0.4);
  const end = mixHex(secondary.base, secondary.dark, 0.2);
  const background = mixHex(primary.dark, secondary.dark, 0.5);
  const accent = mixHex(primary.light, secondary.light, 0.5);

  return { start, end, background, accent };
};
