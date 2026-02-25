import type { IucnStatus } from '../../types/lens'

type IucnSummaryPanelProps = {
  summary: IucnStatus[]
}

const IucnSummaryPanel = ({ summary }: IucnSummaryPanelProps) => (
  <div className="rounded-xl border-4 border-border bg-gold p-6 shadow-soft">
    <h2 className="text-xl font-semibold text-ink">IUCN summary</h2>
    <p className="mt-2 text-xs text-ink">Placeholder conservation status mix.</p>
    <div className="mt-4 grid grid-cols-2 gap-3">
      {summary.map((item) => (
        <div
          key={item.status}
          className="rounded-lg border-4 border-border bg-paper p-3 shadow-soft"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{item.status}</span>
            <span className="text-xs text-ink-soft">{item.count}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">{item.label}</p>
        </div>
      ))}
    </div>
  </div>
)

export default IucnSummaryPanel
