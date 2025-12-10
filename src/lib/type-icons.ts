import bugTypeIcon from '@/assets/types/bug_type.png?url';
import dragonTypeIcon from '@/assets/types/dragon_type.png?url';
import electricTypeIcon from '@/assets/types/electric_type.png?url';
import fairyTypeIcon from '@/assets/types/fairy_type.png?url';
import fightingTypeIcon from '@/assets/types/fighting_type.png?url';
import fireTypeIcon from '@/assets/types/fire_type.png?url';
import flyingTypeIcon from '@/assets/types/flying_type.png?url';
import ghostTypeIcon from '@/assets/types/ghost_type.png?url';
import grassTypeIcon from '@/assets/types/grass_type.png?url';
import groundTypeIcon from '@/assets/types/ground_type.png?url';
import iceTypeIcon from '@/assets/types/ice_type.png?url';
import normalTypeIcon from '@/assets/types/normal_type.png?url';
import poisonTypeIcon from '@/assets/types/poison_type.png?url';
import psychicTypeIcon from '@/assets/types/psychic_type.png?url';
import rockTypeIcon from '@/assets/types/rock_type.png?url';
import steelTypeIcon from '@/assets/types/steel_type.png?url';
import waterTypeIcon from '@/assets/types/water_type.png?url';

const TYPE_ICON_MAP = {
  bug: bugTypeIcon,
  dragon: dragonTypeIcon,
  electric: electricTypeIcon,
  fairy: fairyTypeIcon,
  fighting: fightingTypeIcon,
  fire: fireTypeIcon,
  flying: flyingTypeIcon,
  ghost: ghostTypeIcon,
  grass: grassTypeIcon,
  ground: groundTypeIcon,
  ice: iceTypeIcon,
  normal: normalTypeIcon,
  poison: poisonTypeIcon,
  psychic: psychicTypeIcon,
  rock: rockTypeIcon,
  steel: steelTypeIcon,
  water: waterTypeIcon,
} as const;

export type TypeIconSlug = keyof typeof TYPE_ICON_MAP;

const hasTypeIcon = (slug: string): slug is TypeIconSlug => slug in TYPE_ICON_MAP;

export const getTypeIconSrc = (typeName?: string): string | null => {
  if (!typeName) return null;
  const slug = typeName.trim().toLowerCase();
  if (!hasTypeIcon(slug)) {
    return null;
  }
  return TYPE_ICON_MAP[slug];
};

export const TYPE_ICON_SLUGS = Object.keys(TYPE_ICON_MAP) as TypeIconSlug[];

export default TYPE_ICON_MAP;
