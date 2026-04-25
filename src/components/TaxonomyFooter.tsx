/**
 * Attribution footer. The old kingdom + class bubble rows were removed
 * because rank-level latin names ("Magnoliopsida", "Liliopsida") meant
 * nothing to a regular viewer. Kingdom share is now expressed as a single
 * plain-language sentence in the hero header instead.
 */

type DatasetSummary = {
  key: string; title: string; doi?: string; publisher?: string; license?: string
}

type TaxonomyFooterProps = {
  placeLabel?: string
  totalRecords: number
  datasetSummaries: DatasetSummary[]
}

function TaxonomyFooter({
  placeLabel,
  totalRecords,
  datasetSummaries,
}: TaxonomyFooterProps) {
  return (
    <footer className="poster-footer">
      <p className="poster-footer__text">
        Powered by <strong>GBIF</strong> open biodiversity data · Generated
        by <strong>Lynxee</strong>
        {placeLabel && <> · {placeLabel}</>}
        {totalRecords > 0 && <> · {totalRecords.toLocaleString()} records</>}
      </p>
      {datasetSummaries.length > 0 && (
        <p className="poster-footer__datasets">
          Top datasets:{' '}
          {datasetSummaries
            .slice(0, 3)
            .map((ds) => ds.title)
            .join(' · ')}
        </p>
      )}
    </footer>
  )
}

export default TaxonomyFooter
