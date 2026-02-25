import type { SpeciesCard } from '../../types/lens'

type TopSpeciesPanelProps = {
  species: SpeciesCard[]
}

const TopSpeciesPanel = ({ species }: TopSpeciesPanelProps) => (
  <div className="rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Top species</h2>
      <span className="text-[11px] uppercase tracking-[0.2em] text-ink">
        {species.length} featured
      </span>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {species.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-lg border-4 border-border bg-paper shadow-soft"
        >
          <img
            src={item.imageUrl}
            alt={item.commonName}
            className="h-32 w-full object-cover"
            loading="lazy"
          />
          <div className="space-y-1 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{item.commonName}</p>
            <p className="text-xs italic text-ink-soft">
              {item.scientificName}
            </p>
            <p className="text-[11px] text-ink">{item.highlight}</p>
          </div>
        </article>
      ))}
    </div>
  </div>
)

export default TopSpeciesPanel
