import { motion } from 'framer-motion'

type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
  taxonLine?: string
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
  const peakYear = yearTrend.reduce(
    (peak, item) => (item.count > peak.count ? item : peak),
    yearTrend[0] ?? { year: 0, count: 0 },
  )

  const hoverMotion = {
    whileHover: { y: -6, scale: 1.02 },
    whileFocus: { y: -6, scale: 1.02 },
  }

  return (
    <>
      <section className="collage-hero collage-hero--species grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <motion.div
          className="collage-panel collage-panel--primary paper-card bg-surface p-6 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="poster-title text-2xl text-ink">Top species</h2>
            <span className="sticker-badge">{topSpecies.length} featured</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {topSpecies.map((species) => (
              <motion.article
                key={species.id}
                className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow overflow-hidden bg-paper"
                whileHover={{ y: -4, scale: 1.02 }}
                whileFocus={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.24 }}
              >
                <div className="relative">
                  <span className="hover-stamp hover-stamp--image">
                    {species.taxonLine ?? 'GBIF species'}
                  </span>
                  <img
                    src={species.imageUrl}
                    alt={species.commonName}
                    className="h-32 w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-1 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">
                    {species.commonName}
                  </p>
                  <p className="text-xs italic text-ink-soft">
                    {species.scientificName}
                  </p>
                  <p className="text-[11px] text-ink">{species.highlight}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="collage-panel collage-panel--float paper-card bg-gold p-6 lg:-mt-8 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <h2 className="poster-title text-2xl text-ink">IUCN summary</h2>
          <p className="mt-2 text-xs text-ink">
            Conservation status mix from GBIF facets.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {iucnSummary.map((item) => {
              return (
                <motion.div
                  key={item.status}
                  className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper p-3"
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileFocus={{ y: -4, scale: 1.02 }}
                  transition={{ duration: 0.24 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="sticker-badge sticker-badge--sunny">
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
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </section>

      <section className="collage-hero collage-hero--charts grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <motion.div
          className="collage-panel collage-panel--tilt-left paper-card bg-surface p-6 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="poster-title text-2xl text-ink">Seasonality</h2>
            <span className="sticker-badge">Monthly records</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            {seasonality.map((value, index) => (
              <div key={`month-${value}-${index}`} className="hover-group flex-1">
                <motion.div
                  className="hover-glow rounded-md border-2 border-border bg-lens-strong"
                  style={{ height: `${(value / maxSeasonality) * 140}px` }}
                  whileHover={{ y: -4, scale: 1.04 }}
                  whileFocus={{ y: -4, scale: 1.04 }}
                  transition={{ duration: 0.22 }}
                />
                <p className="mt-2 text-center text-[10px] text-ink">
                  {index + 1}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="collage-panel collage-panel--tilt-right paper-card bg-surface p-6 lg:-mt-6 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="poster-title text-2xl text-ink">Year trend</h2>
            <span className="sticker-badge">Records per year</span>
          </div>
          <span className="hover-stamp hover-stamp--top-right">
            Peak {peakYear.year} · {peakYear.count.toLocaleString()}
          </span>
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
        </motion.div>
      </section>
    </>
  )
}

export default LensMainPanels
