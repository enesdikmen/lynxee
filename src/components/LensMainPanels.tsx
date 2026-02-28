import { motion } from 'framer-motion'
import type { ConservationSnapshot } from '../types/lens'

type SpeciesCard = {
  id: string
  commonName: string
  scientificName: string
  imageUrl: string
  highlight: string
  taxonLine?: string
  popularity?: number
}

type YearTrendPoint = {
  year: number
  count: number
}

type LensMainPanelsProps = {
  topSpecies: SpeciesCard[]
  conservationSnapshot: ConservationSnapshot
  seasonality: number[]
  maxSeasonality: number
  yearTrend: YearTrendPoint[]
  maxTrend: number
}

function LensMainPanels({
  topSpecies,
  conservationSnapshot,
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
      <section className="collage-hero collage-hero--species grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <motion.div
          className="collage-panel collage-panel--primary paper-card bg-surface p-5 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="poster-title text-2xl text-ink">Top species</h2>
            <span className="sticker-badge">{topSpecies.length} featured</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {topSpecies.map((species) => (
              <motion.article
                key={species.id}
                className="species-card paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper"
                whileHover={{ y: -4, scale: 1.02 }}
                whileFocus={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.24 }}
              >
                <span className="hover-stamp hover-stamp--species">
                  {species.taxonLine ?? 'GBIF species'}
                </span>
                <div className="species-card__image">
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
                  <p className="text-[11px] font-semibold text-ink">
                    {species.popularity
                      ? `${species.popularity.toLocaleString()} records`
                      : 'Records unknown'}
                  </p>
                  <p className="text-[11px] text-ink">{species.highlight}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="collage-panel collage-panel--float paper-card bg-gold p-5 lg:-mt-2 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <h2 className="poster-title text-2xl text-ink">
            Conservation snapshot
          </h2>

          {/* ── Headline stat ── */}
          <div className="mt-3 paper-card paper-card--mini bg-paper p-4">
            <p className="text-3xl font-extrabold text-ink leading-tight">
              {conservationSnapshot.threatenedCount}
              <span className="text-base font-semibold text-ink-soft ml-1">
                threatened species
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Out of {conservationSnapshot.totalAssessedSpecies} species with a
              conservation status observed here
              {conservationSnapshot.threatenedPercent > 0 && (
                <> — that's {conservationSnapshot.threatenedPercent}%</>
              )}
            </p>
          </div>

          {/* ── Stacked species bar ── */}
          {conservationSnapshot.totalAssessedSpecies > 0 && (
            <div className="mt-3">
              <div className="flex h-4 w-full overflow-hidden rounded-full border-2 border-border">
                {conservationSnapshot.categoryBreakdown
                  .filter((c) => c.count > 0)
                  .map((c) => {
                    const pct =
                      (c.count / conservationSnapshot.totalAssessedSpecies) * 100
                    const colors: Record<string, string> = {
                      LC: '#4ade80',
                      NT: '#facc15',
                      VU: '#fb923c',
                      EN: '#f87171',
                      CR: '#dc2626',
                      DD: '#a1a1aa',
                    }
                    return (
                      <div
                        key={c.status}
                        title={`${c.label}: ${c.count} species`}
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: colors[c.status] ?? '#e5e7eb',
                          minWidth: c.count > 0 ? '3px' : 0,
                        }}
                      />
                    )
                  })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {conservationSnapshot.categoryBreakdown
                  .filter((c) => c.count > 0)
                  .map((c) => {
                    const dotColors: Record<string, string> = {
                      LC: '#4ade80',
                      NT: '#facc15',
                      VU: '#fb923c',
                      EN: '#f87171',
                      CR: '#dc2626',
                      DD: '#a1a1aa',
                    }
                    return (
                      <span
                        key={c.status}
                        className="flex items-center gap-1 text-[10px] text-ink-soft"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: dotColors[c.status] ?? '#e5e7eb',
                          }}
                        />
                        {c.status} {c.count}
                      </span>
                    )
                  })}
              </div>
            </div>
          )}

          {/* ── Threatened species list ── */}
          {conservationSnapshot.threatenedSpecies.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-semibold text-ink uppercase tracking-wide">
                Species at risk nearby
              </p>
              {conservationSnapshot.threatenedSpecies.map((sp) => {
                const borderColors: Record<string, string> = {
                  CR: '#dc2626',
                  EN: '#f87171',
                  VU: '#fb923c',
                }
                return (
                  <motion.div
                    key={sp.speciesKey}
                    className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper flex items-center gap-3 p-2"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor:
                        borderColors[sp.iucnCategory] ?? '#e5e7eb',
                    }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileFocus={{ y: -3, scale: 1.01 }}
                    transition={{ duration: 0.22 }}
                  >
                    {sp.imageUrl && (
                      <img
                        src={sp.imageUrl}
                        alt={sp.commonName}
                        className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">
                        {sp.commonName}
                      </p>
                      <p className="text-[10px] italic text-ink-soft truncate">
                        {sp.scientificName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span
                        className="sticker-badge text-[10px]"
                        style={{
                          backgroundColor:
                            borderColors[sp.iucnCategory] ?? '#e5e7eb',
                          color: sp.iucnCategory === 'VU' ? '#1f2937' : '#fff',
                        }}
                      >
                        {sp.iucnCategory}
                      </span>
                      <span className="text-[10px] text-ink-soft mt-0.5">
                        {sp.recordCount.toLocaleString()} records
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          <p className="mt-3 text-[10px] text-ink-soft leading-snug">
            Threatened = Critically Endangered + Endangered + Vulnerable (IUCN
            Red List). Counts reflect distinct species in GBIF records for this
            area, not a complete census.
          </p>
        </motion.div>
      </section>

      <section className="collage-hero collage-hero--charts grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <motion.div
          className="collage-panel collage-panel--tilt-left paper-card bg-surface p-5 hover-group"
          {...hoverMotion}
          transition={{ duration: 0.24 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="poster-title text-2xl text-ink">Seasonality</h2>
            <span className="sticker-badge">Monthly records</span>
          </div>
          <div className="mt-3 flex items-end gap-2">
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
          className="collage-panel collage-panel--tilt-right paper-card bg-surface p-5 lg:-mt-4 hover-group"
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
          <div className="mt-3">
            <svg viewBox="0 0 240 120" className="h-32 w-full">
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
