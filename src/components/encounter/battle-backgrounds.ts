import normalBattle from '@/assets/battles/normal_battle.jpg?url';
import normalBattle2 from '@/assets/battles/normal_battle_2.jpg?url';
import normalBattle3 from '@/assets/battles/normal_battle_3.jpg?url';
import normalBattle4 from '@/assets/battles/normal_battle_4.png?url';
import rockBattle from '@/assets/battles/rock_battle.png?url';
import waterBattle from '@/assets/battles/water_battle.jpg?url';
import waterBattle2 from '@/assets/battles/water_battle_2.png?url';
import type { PokemonTypeDto } from '@/types';

const FALLBACK_BACKGROUND = normalBattle;

const TYPE_BACKGROUND_MAP: Record<string, readonly string[]> = {
  normal: [normalBattle4, normalBattle3, normalBattle2, FALLBACK_BACKGROUND],
  water: [waterBattle2, waterBattle],
  rock: [rockBattle],
};

const TYPE_ALIAS_MAP: Record<string, string> = {
  ground: 'rock',
  steel: 'rock',
  ice: 'water',
};

const normalizeTypeName = (typeName?: string): string | null => {
  if (!typeName) return null;
  return typeName.trim().toLowerCase() || null;
};

const findBackgroundForType = (typeName: string): string | null => {
  const alias = TYPE_ALIAS_MAP[typeName] ?? typeName;
  const options = TYPE_BACKGROUND_MAP[alias];
  if (!options?.length) return null;
  return options[0] ?? null;
};

export const getBattleBackgroundSrc = (types: PokemonTypeDto[]): string => {
  for (const type of types) {
    const normalized = normalizeTypeName(type.name);
    if (!normalized) continue;
    const match = findBackgroundForType(normalized);
    if (match) return match;
  }
  return FALLBACK_BACKGROUND;
};
