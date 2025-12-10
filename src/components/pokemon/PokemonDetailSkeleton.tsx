export function PokemonDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-white/15" />
          <div className="h-6 w-48 animate-pulse rounded-full bg-white/20" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`stats-skeleton-${index}`}
              className="h-3 w-full animate-pulse rounded-full bg-white/10"
            />
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-5 sm:px-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/15" />
        <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-white/10" />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-5 sm:px-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/15" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`evolution-skeleton-${index}`}
              className="h-24 w-full animate-pulse rounded-2xl bg-white/10"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
