export function SkeletonCard() {
  return (
    <div className="relative h-64 animate-pulse overflow-hidden rounded-2xl border border-white/5 bg-slate-900/40">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/10 to-white/5" />
      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 py-8">
        <div className="h-20 w-20 rounded-full bg-white/10" />
        <div className="h-4 w-32 rounded-full bg-white/10" />
        <div className="h-3 w-20 rounded-full bg-white/5" />
      </div>
    </div>
  );
}
