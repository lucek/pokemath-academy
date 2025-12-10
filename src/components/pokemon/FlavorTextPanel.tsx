interface FlavorTextPanelProps {
  readonly flavorText: string | null;
  readonly region?: string | null;
}

export function FlavorTextPanel({ flavorText, region }: FlavorTextPanelProps) {
  const text = flavorText?.trim();
  const content = text && text.length > 0 ? text : 'No flavor text available yet.';

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 text-white shadow-lg shadow-black/20 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
            Pokédex entry
          </h3>
          <p className="mt-1 text-lg font-semibold">Trainer insight</p>
        </div>
        {region ? (
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs tracking-[0.3em] text-white/70 uppercase">
            {region}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-base leading-relaxed text-white/80">{content}</p>
    </section>
  );
}
