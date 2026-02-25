import type { YearTrendPoint } from '../../types/lens'

type YearTrendPanelProps = {
  data: YearTrendPoint[]
  max: number
}

const YearTrendPanel = ({ data, max }: YearTrendPanelProps) => (
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
          points={data
            .map((item, index) => {
              const denominator = data.length - 1 || 1
              const x = (index / denominator) * 220 + 10
              const y = 110 - (item.count / max) * 90 + 5
              return `${x},${y}`
            })
            .join(' ')}
        />
        {data.map((item, index) => {
          const denominator = data.length - 1 || 1
          const x = (index / denominator) * 220 + 10
          const y = 110 - (item.count / max) * 90 + 5
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
        {data.map((item) => (
          <span key={`year-${item.year}`}>{item.year}</span>
        ))}
      </div>
    </div>
  </div>
)

export default YearTrendPanel
