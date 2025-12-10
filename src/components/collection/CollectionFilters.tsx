import { type ChangeEvent } from 'react';
import { ArrowDownUp, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CollectionFiltersState, CollectionCaughtFilter } from './types';

const CAUGHT_OPTIONS: { value: CollectionCaughtFilter; label: string; description: string }[] = [
  { value: 'all', label: 'All Pokémon', description: 'Show both captured and uncaught' },
  { value: 'caught', label: 'Caught', description: 'Only captured entries' },
  { value: 'uncaught', label: 'Uncaught', description: 'Focus on remaining targets' },
];

const SORT_OPTIONS: { value: CollectionFiltersState['sort']; label: string }[] = [
  { value: 'pokedex', label: 'Pokédex #' },
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Capture Date' },
];

interface CollectionFiltersProps {
  value: CollectionFiltersState;
  busy?: boolean;
  onChange: (update: Partial<CollectionFiltersState>) => void;
  onReset: () => void;
}

export function CollectionFilters({
  value,
  busy = false,
  onChange,
  onReset,
}: CollectionFiltersProps) {
  const shinyDisabled = value.caught === 'uncaught';

  const handleCaughtChange = (next: CollectionCaughtFilter) => {
    if (value.caught === next) return;
    onChange({ caught: next });
  };

  const handleVariantChange = (variant: CollectionFiltersState['variant']) => {
    if (variant === value.variant) return;
    if (variant === 'shiny' && shinyDisabled) return;
    onChange({ variant: shinyDisabled ? 'all' : variant });
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value as CollectionFiltersState['sort'];
    onChange({ sort: nextValue });
  };

  const handleOrderToggle = () => {
    onChange({ order: value.order === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-cyan-300/90 uppercase">Filters</p>
          <h2 className="text-xl font-semibold text-white">Refine your Pokédex</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onReset}
          className="gap-2"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Clear Filters
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset
          className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          aria-label="Caught filter"
        >
          <legend className="text-sm font-semibold text-slate-100">Capture status</legend>
          <div className="grid gap-2">
            {CAUGHT_OPTIONS.map((option) => {
              const isActive = value.caught === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCaughtChange(option.value)}
                  disabled={busy}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:outline-none',
                    isActive
                      ? 'border-cyan-300/70 bg-cyan-500/10 text-white shadow-inner shadow-cyan-500/20'
                      : 'border-white/10 bg-slate-950/40 text-slate-200 hover:border-white/30',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1 size-2.5 rounded-full border',
                      isActive
                        ? 'border-cyan-200 bg-cyan-300 shadow shadow-cyan-500/40'
                        : 'border-white/30 bg-transparent',
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-slate-400">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset
          className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          aria-label="Variant filter"
        >
          <legend className="text-sm font-semibold text-slate-100">Variants</legend>
          <div className="flex flex-wrap gap-2">
            {(['all', 'normal', 'shiny'] as CollectionFiltersState['variant'][]).map((variant) => {
              const isActive = value.variant === variant;
              const disabled = busy || (variant === 'shiny' && shinyDisabled);
              return (
                <button
                  key={variant}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleVariantChange(variant)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition focus-visible:ring-2 focus-visible:ring-yellow-300/60 focus-visible:outline-none',
                    isActive
                      ? 'border-yellow-200/70 bg-yellow-500/10 text-yellow-50 shadow-inner shadow-yellow-500/20'
                      : 'border-white/10 bg-slate-950/40 text-slate-200 hover:border-white/30',
                    disabled && 'opacity-50',
                  )}
                >
                  {variant === 'shiny' ? <Sparkles className="size-3" /> : null}
                  {variant === 'all' ? 'All' : variant === 'normal' ? 'Normal' : 'Shiny'}
                </button>
              );
            })}
          </div>
          {shinyDisabled && (
            <p className="text-xs text-slate-400">Catch it first to filter by shiny.</p>
          )}
        </fieldset>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
          Sort by
          <select
            className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-base text-white transition hover:border-white/30 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={value.sort}
            onChange={handleSortChange}
            disabled={busy}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-sm font-semibold text-slate-100">Order</p>
          <p className="text-xs text-slate-400">Toggle ascending / descending</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full gap-2 border-white/20 bg-slate-950/40 text-slate-100 hover:border-cyan-300/60 hover:bg-cyan-500/10"
            disabled={busy}
            onClick={handleOrderToggle}
          >
            <ArrowDownUp className="size-4" />
            {value.order === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
        </div>

        <div className="rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-4 text-sm text-slate-400">
          <p className="font-medium text-slate-200">Keyboard tips</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            <li>Use Tab / Shift + Tab to move between controls</li>
            <li>Press Space or Enter to toggle captured categories</li>
            <li>Use the type filter cards above the grid to narrow by element</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
