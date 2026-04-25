/**
 * How we know this — honesty strip mandated by the spec.
 * Shows the basisOfRecord breakdown in plain language so viewers
 * understand the data is observation-based (not a census of nature).
 */
import type { RecordsBreakdownItem } from '../hooks/useLensData'

type Props = {
  totalRecords: number
  recordsBreakdown: RecordsBreakdownItem[]
}

const fmtPct = (share: number) => {
  if (share >= 0.1) return `${Math.round(share * 100)}%`
  if (share >= 0.01) return `${(share * 100).toFixed(1)}%`
  return '<1%'
}

function HowWeKnow({ totalRecords, recordsBreakdown }: Props) {
  if (!recordsBreakdown.length || totalRecords === 0) return null

  // Show the top 3 buckets — anything smaller is collapsed into "+ other".
  const top = recordsBreakdown.slice(0, 3)
  const rest = recordsBreakdown.slice(3)
  const restShare = rest.reduce((s, item) => s + item.share, 0)

  return (
    <section className="how-we-know" aria-label="How we know this">
      <header className="how-we-know__header">
        <span className="how-we-know__kicker">How we know this</span>
        <p className="how-we-know__intro">
          {totalRecords.toLocaleString()} records published to GBIF — a global
          open archive of life on Earth. This reflects <em>observation effort</em>,
          not all life present.
        </p>
      </header>

      <ul className="how-we-know__rows">
        {top.map((item) => (
          <li key={item.key} className="how-we-know__row">
            <div className="how-we-know__row-head">
              <span className="how-we-know__row-pct">{fmtPct(item.share)}</span>
              <span className="how-we-know__row-label">{item.label}</span>
            </div>
            <div className="how-we-know__bar">
              <div
                className="how-we-know__bar-fill"
                style={{ width: `${Math.max(item.share * 100, 1.5)}%` }}
              />
            </div>
            {item.hint && (
              <span className="how-we-know__row-hint">{item.hint}</span>
            )}
          </li>
        ))}
        {restShare > 0.005 && (
          <li className="how-we-know__row how-we-know__row--rest">
            <span className="how-we-know__row-pct">{fmtPct(restShare)}</span>
            <span className="how-we-know__row-label">
              + {rest.length} other source{rest.length === 1 ? '' : 's'}
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}

export default HowWeKnow
