type BreakdownItem = {
  label: string
  count: number
}

type LensBreakdownProps = {
  kingdomBreakdown: BreakdownItem[]
  classBreakdown: BreakdownItem[]
  maxKingdom: number
  maxClass: number
  placeLabel?: string
  totalRecords: number
  datasetTitles: string[]
}

function LensBreakdown({
  kingdomBreakdown,
  classBreakdown,
  maxKingdom,
  maxClass,
  placeLabel,
  totalRecords,
  datasetTitles,
}: LensBreakdownProps) {
  return (
    <section className="collage-hero collage-hero--badges grid gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:items-start">
      <div className="collage-panel collage-panel--wide rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Kingdom + class breakdown</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              Kingdoms
            </p>
            <div className="mt-3 space-y-2">
              {kingdomBreakdown.map((item) => (
                <div key={item.label} className="space-y-1">
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
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              Classes
            </p>
            <div className="mt-3 space-y-2">
              {classBreakdown.map((item) => (
                <div key={item.label} className="space-y-1">
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="collage-panel collage-panel--float rounded-xl border-4 border-border bg-lens p-6 shadow-card lg:-mt-10">
        <h2 className="text-xl font-semibold text-ink">Attribution</h2>
        <div className="collage-badge-stack mt-3 space-y-3 text-xs text-ink">
          <div className="rounded-lg border-2 border-border bg-paper p-3">
            <p className="font-semibold">GBIF occurrence download</p>
            <p className="text-ink-soft">
              {placeLabel ?? 'Selected place'} · {totalRecords.toLocaleString()} records
            </p>
          </div>
          <div className="rounded-lg border-2 border-border bg-paper p-3">
            <p className="font-semibold">Top datasets</p>
            {datasetTitles.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-[11px] text-ink-soft">
                {datasetTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-ink-soft">
                Loading dataset metadata…
              </p>
            )}
          </div>
          <div className="rounded-lg border-2 border-border bg-paper p-3">
            <p className="font-semibold">Media credits</p>
            <p className="text-[11px] text-ink-soft">
              Image credits will be pulled from GBIF media.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LensBreakdown
