import { motion } from 'framer-motion'

type BreakdownItem = {
  label: string
  count: number
}

type DatasetSummary = {
  key: string
  title: string
  doi?: string
  publisher?: string
  license?: string
}

type LensBreakdownProps = {
  kingdomBreakdown: BreakdownItem[]
  classBreakdown: BreakdownItem[]
  maxKingdom: number
  maxClass: number
  placeLabel?: string
  totalRecords: number
  datasetSummaries: DatasetSummary[]
}

function LensBreakdown({
  kingdomBreakdown,
  classBreakdown,
  maxKingdom,
  maxClass,
  placeLabel,
  totalRecords,
  datasetSummaries,
}: LensBreakdownProps) {
  const hoverMotion = {
    whileHover: { y: -6, scale: 1.02 },
    whileFocus: { y: -6, scale: 1.02 },
    transition: { duration: 0.24 },
  }

  return (
    <section className="collage-hero collage-hero--badges grid gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:items-start">
      <motion.div
        className="collage-panel collage-panel--wide paper-card bg-surface p-6 hover-group"
        {...hoverMotion}
      >
        <h2 className="poster-title text-2xl text-ink">Kingdom + class breakdown</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="sticker-badge">Kingdoms</p>
            <div className="mt-3 space-y-2">
              {kingdomBreakdown.map((item) => (
                <motion.div
                  key={item.label}
                  className="hover-group hover-glow space-y-1"
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileFocus={{ y: -2, scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className="text-ink-soft">{item.count}</span>
                  </div>
                  <div className="h-3 rounded-full border-2 border-border bg-paper">
                    <div
                      className="h-full rounded-full bg-lens"
                      style={{ width: `${(item.count / maxKingdom) * 100}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div>
            <p className="sticker-badge">Classes</p>
            <div className="mt-3 space-y-2">
              {classBreakdown.map((item) => (
                <motion.div
                  key={item.label}
                  className="hover-group hover-glow space-y-1"
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileFocus={{ y: -2, scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className="text-ink-soft">{item.count}</span>
                  </div>
                  <div className="h-3 rounded-full border-2 border-border bg-paper">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(item.count / maxClass) * 100}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="collage-panel collage-panel--float paper-card bg-lens p-6 lg:-mt-10 hover-group"
        {...hoverMotion}
      >
        <h2 className="poster-title text-2xl text-ink">Attribution</h2>
        <div className="collage-badge-stack mt-3 space-y-3 text-xs text-ink">
          <motion.div
            className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper p-3"
            whileHover={{ y: -3, scale: 1.02 }}
            whileFocus={{ y: -3, scale: 1.02 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-semibold">GBIF occurrence download</p>
            <p className="text-ink-soft">
              {placeLabel ?? 'Selected place'} · {totalRecords.toLocaleString()} records
            </p>
          </motion.div>
          <motion.div
            className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper p-3"
            whileHover={{ y: -3, scale: 1.02 }}
            whileFocus={{ y: -3, scale: 1.02 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-semibold">Top datasets</p>
            {datasetSummaries.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-[11px] text-ink-soft">
                {datasetSummaries.map((dataset) => (
                  <li key={dataset.key}>{dataset.title}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-ink-soft">
                Loading dataset metadata…
              </p>
            )}
          </motion.div>
          <motion.div
            className="paper-card paper-card--mini paper-card--wiggle hover-group hover-glow bg-paper p-3"
            whileHover={{ y: -3, scale: 1.02 }}
            whileFocus={{ y: -3, scale: 1.02 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-semibold">Media credits</p>
            <p className="text-[11px] text-ink-soft">
              Image credits will be pulled from GBIF media.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

export default LensBreakdown
