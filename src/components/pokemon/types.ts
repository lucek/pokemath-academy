import type { PokemonCaptureStatusDto, PokemonStatsDto, PokemonTypeDto } from '@/types';

import type { EncounterPokemonViewModel } from '@/components/encounter/types';

export interface PokemonDetailViewModel {
  id: number;
  name: string;
  flavorText: string | null;
  region?: string | null;
  types: PokemonTypeDto[];
  spriteNormal: string;
  spriteShiny: string;
  stats: PokemonStatsDto;
  evolutionLine?: EvolutionLineViewModel;
  captureStatus?: PokemonCaptureStatusDto;
}

export type PokemonDetailHeaderVm = EncounterPokemonViewModel;

export interface EvolutionLineOverviewVm {
  id: number;
  name: string;
  sprite: string;
  inCollection: boolean;
}

export interface EvolutionLineEntryVm extends EvolutionLineOverviewVm {
  isCurrent: boolean;
  baseId: number | null;
  canEvolve: boolean;
  types: PokemonTypeDto[];
}

export interface EvolutionLineViewModel {
  pokemon: EvolutionLineOverviewVm;
  evolutions: EvolutionLineEntryVm[];
}

export interface StatsBarEntry {
  key: 'hp' | 'attack' | 'defense' | 'speed';
  label: string;
  value: number;
  percent: number;
  color: string;
}
