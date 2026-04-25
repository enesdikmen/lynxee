/**
 * Data illustrations — seasonality dots, year trend line, conservation seal.
 * Everything painted directly on the poster surface. No card containers.
 */
import { motion } from 'framer-motion'
import type { ConservationSnapshot } from '../types/lens'

type YearTrendPoint = { year: number; count: number }

type DataIllustrationsProps = {
  seasonality: number[]
  maxSeasonality: number
  yearTrend: YearTrendPoint[]
  maxTrend: number
  conservationSnapshot: ConservationSnapshot
}

const MONTH = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const IUCN_COLORS: Record<string, string> = {
  LC: '#4ade80', NT: '#facc15', VU: '#fb923c',
  EN: '#f87171', CR: '#dc2626', DD: '#a1a1aa',
}

function DataIllustrations({
  seasonality, maxSeasonality,
  yearTrend, maxTrend,
  conservationSnapshot,
}: DataIllustrationsProps) {
  // yearTrend / maxTrend kept on the props for now but no longer rendered.
  // The trend line was misleading to non-experts (it shows uploader effort,
  // not biodiversity), so we removed it from the poster.
  void yearTrend
  void maxTrend

  return (
    <section className="data-illustrations">
      {/* ── Seasonality — bubble sizes ── */}
      <div className="season-row">
        <p className="season-row__title">When life is observed · monthly</p>
        <div className="season-dots">
          {seasonality.map((val, i) => {
            const ratio = maxSeasonality > 0 ? val / maxSeasonality : 0
            const size = Math.max(ratio * 44, 8)
            return (
              <div key={`m-${i}`} className="season-dot">
                <motion.div
                  className="season-dot__bubble"
                  style={{ width: size, height: size }}
                  whileHover={{ scale: 1.25 }}
                  transition={{ duration: 0.18 }}
                />
                <span className="season-dot__label">{MONTH[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Conservation — plain-language Red List summary ──
          Replaces the old IUCN code soup (LC/NT/VU/EN/CR/DD) with three buckets
          and full sentences a non-scientist can parse at a glance. */}
      <div className="conservation-strip">
        <motion.div
          className="conservation-seal"
          whileHover={{ rotate: 0, scale: 1.06 }}
          transition={{ duration: 0.3 }}
        >
          <span className="conservation-seal__count">
            {conservationSnapshot.threatenedCount}
          </span>
          <span className="conservation-seal__label">At-risk species</span>
          <span className="conservation-seal__sub">
            may disappear from here
          </span>
        </motion.div>

        <div className="conservation-details">
          <p
            style={{
              fontSize: '0.6rem',
              color: 'rgb(var(--color-ink-soft))',
              marginBottom: '0.5rem',
              lineHeight: 1.4,
            }}
          >
            Status of {conservationSnapshot.totalAssessedSpecies} species
            checked by the <strong>IUCN Red List</strong> — a global health
            check that flags whether a species is doing fine or in trouble.
          </p>

          {/* Three plain-language buckets instead of a 6-color jargon bar */}
          {conservationSnapshot.totalAssessedSpecies > 0 && (() => {
            const get = (s: string) =>
              conservationSnapshot.categoryBreakdown.find((c) => c.status === s)
                ?.count ?? 0
            const doingWell = get('LC')
            const watchList = get('NT') + get('DD')
            const atRisk = get('VU') + get('EN') + get('CR')
            const buckets = [
              {
                label: 'Doing well',
                hint: 'plenty of records, no concern',
                count: doingWell,
                color: '#4ade80',
              },
              {
                label: 'Watch list',
                hint: 'near-threatened or not enough data',
                count: watchList,
                color: '#facc15',
              },
              {
                label: 'At risk',
                hint: 'vulnerable, endangered or critical',
                count: atRisk,
                color: '#f87171',
              },
            ]
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.6rem',
                  marginBottom: '0.8rem',
                }}
              >
                {buckets.map((b) => (
                  <div key={b.label} style={{ display: 'flex', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: b.color,
                        border: '2px solid rgb(var(--color-ink))',
                        flexShrink: 0,
                        marginTop: '0.15rem',
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '0.7rem',
                          color: 'rgb(var(--color-ink))',
                        }}
                      >
                        {b.count} {b.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.5rem',
                          color: 'rgb(var(--color-ink-soft))',
                          lineHeight: 1.3,
                        }}
                      >
                        {b.hint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Threatened species thumbnails — full plain-language label, no codes */}
          {conservationSnapshot.threatenedSpecies.length > 0 && (
            <>
              <p
                style={{
                  fontSize: '0.55rem',
                  color: 'rgb(var(--color-ink-soft))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: '0.3rem',
                }}
              >
                Some of the at-risk species seen here
              </p>
              <div className="threatened-row">
                {conservationSnapshot.threatenedSpecies.slice(0, 4).map((sp) => (
                  <motion.div
                    key={sp.speciesKey}
                    className="threatened-thumb"
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.18 }}
                    style={{ minWidth: 0 }}
                  >
                    {sp.imageUrl && (
                      <img
                        src={sp.imageUrl}
                        alt={sp.commonName}
                        className="threatened-thumb__img"
                        loading="lazy"
                      />
                    )}
                    <div className="threatened-thumb__info">
                      <span className="threatened-thumb__name">
                        {sp.commonName}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.5rem',
                          color: IUCN_COLORS[sp.iucnCategory] ?? '#444',
                          fontWeight: 600,
                        }}
                      >
                        {sp.iucnLabel}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default DataIllustrations
