type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
}

type IucnSummaryItem = {
  status: string
  label: string
  count: number
}

type YearTrendPoint = {
  year: number
  count: number
}

type LensMainPanelsProps = {
  topSpecies: SpeciesCard[]
  iucnSummary: IucnSummaryItem[]
  seasonality: number[]
  maxSeasonality: number
  yearTrend: YearTrendPoint[]
  maxTrend: number
}

function LensMainPanels({
  topSpecies,
  iucnSummary,
  seasonality,
  maxSeasonality,
  yearTrend,
  maxTrend,
}: LensMainPanelsProps) {
  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Top species</h2>
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink">
              {topSpecies.length} featured
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {topSpecies.map((species) => (
              <article
                key={species.id}
                className="overflow-hidden rounded-lg border-4 border-border bg-paper shadow-soft"
              >
                <img
                  src={species.imageUrl}
                  alt={species.commonName}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
                <div className="space-y-1 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">
                    {species.commonName}
                  </p>
                  <p className="text-xs italic text-ink-soft">
                    {species.scientificName}
                  </p>
                  <p className="text-[11px] text-ink">{species.highlight}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-4 border-border bg-gold p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-ink">IUCN summary</h2>
          <p className="mt-2 text-xs text-ink">
            Conservation status mix from GBIF facets.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {iucnSummary.map((item) => (
              <div
                key={item.status}
                className="rounded-lg border-4 border-border bg-paper p-3 shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full border-2 border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-ink">
                    {item.status}
                  </span>
                  <span className="text-xs text-ink-soft">{item.count}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {item.label}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {item.label === 'Unknown'
                    ? 'Status not reported in GBIF records.'
                    : 'IUCN Red List category'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Seasonality</h2>
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink">
              Monthly records
            </span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            {seasonality.map((value, index) => (
              <div key={`month-${value}-${index}`} className="flex-1">
                <div
                  className="rounded-md border-2 border-border bg-lens-strong"
                  style={{ height: `${(value / maxSeasonality) * 140}px` }}
                />
                <p className="mt-2 text-center text-[10px] text-ink">
                  {index + 1}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Year trend</h2>
            <span className="text-[11px] uppercase tracking-[0.2em] text-ink">
              Records per year
            </span>
          </div>
          <div className="mt-4">
            <svg viewBox="0 0 240 120" className="h-36 w-full">
              <polyline
                fill="none"
                stroke="rgb(var(--color-accent))"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={yearTrend
                  .map((item, index) => {
                    const denominator = yearTrend.length - 1 || 1
                    const x = (index / denominator) * 220 + 10
                    const y = 110 - (item.count / maxTrend) * 90 + 5
                    return `${x},${y}`
                  })
                  .join(' ')}
              />
              {yearTrend.map((item, index) => {
                const denominator = yearTrend.length - 1 || 1
                const x = (index / denominator) * 220 + 10
                const y = 110 - (item.count / maxTrend) * 90 + 5
                return (
                  <circle
                    key={item.year}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="rgb(var(--color-forest))"
                    stroke="rgb(var(--color-border))"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
            <div className="mt-2 flex justify-between text-[10px] text-ink">
              {yearTrend.map((item) => (
                <span key={`year-${item.year}`}>{item.year}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default LensMainPanels
