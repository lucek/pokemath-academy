import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  readonly onClearFilters: () => void;
}

export function EmptyState({ onClearFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/20 bg-slate-950/50 px-6 py-12 text-center text-slate-300">
      <div className="text-5xl" aria-hidden="true">
        🔍
      </div>
      <h3 className="text-xl font-semibold text-white">No Pokémon match your filters</h3>
      <p className="text-sm text-slate-400">
        Try resetting your filters or adjust the capture status to see more entries.
      </p>
      <Button
        type="button"
        variant="outline"
        className="border-cyan-400/60 text-cyan-100"
        onClick={onClearFilters}
      >
        Clear Filters
      </Button>
    </div>
  );
}
