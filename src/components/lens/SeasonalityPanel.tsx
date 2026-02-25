type SeasonalityPanelProps = {
  data: number[]
  max: number
}

const SeasonalityPanel = ({ data, max }: SeasonalityPanelProps) => (
  <div className="paper-card bg-surface p-6">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Seasonality</h2>
      <span className="sticker-badge">Monthly records</span>
    </div>
    <div className="mt-4 flex items-end gap-2">
      {data.map((value, index) => (
        <div key={`month-${value}-${index}`} className="flex-1">
          <div
            className="rounded-md border-2 border-border bg-lens-strong"
            style={{ height: `${(value / max) * 140}px` }}
          />
          <p className="mt-2 text-center text-[10px] text-ink">
            {index + 1}
          </p>
        </div>
      ))}
    </div>
  </div>
)

export default SeasonalityPanel
