type AttributionPanelProps = {
  selectedPlaceLabel: string
  totalRecords: number
  datasetTitles: string[]
}

const AttributionPanel = ({
  selectedPlaceLabel,
  totalRecords,
  datasetTitles,
}: AttributionPanelProps) => (
  <div className="rounded-xl border-4 border-border bg-lens p-6 shadow-card">
    <h2 className="text-xl font-semibold text-ink">Attribution</h2>
    <div className="mt-3 space-y-3 text-xs text-ink">
      <div className="rounded-lg border-2 border-border bg-paper p-3">
        <p className="font-semibold">GBIF occurrence download</p>
        <p className="text-ink-soft">
          {selectedPlaceLabel} · {totalRecords.toLocaleString()} records
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
          Placeholder imagery — will be replaced by GBIF media URLs.
        </p>
      </div>
    </div>
  </div>
)

export default AttributionPanel
