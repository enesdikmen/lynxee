import type { BreakdownItem } from '../../types/lens'

type BreakdownPanelProps = {
  kingdomBreakdown: BreakdownItem[]
  classBreakdown: BreakdownItem[]
  maxKingdom: number
  maxClass: number
}

const BreakdownPanel = ({
  kingdomBreakdown,
  classBreakdown,
  maxKingdom,
  maxClass,
}: BreakdownPanelProps) => (
  <div className="rounded-xl border-4 border-border bg-surface p-6 shadow-soft">
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
)

export default BreakdownPanel
