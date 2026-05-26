/**
 * Bento card registry + tile builder.
 *
 * Single source of truth for what cards exist on the poster, how big they
 * are, how they should be placed, and how they render their content.
 *
 * Each card is one entry in {@link CARD_DEFS}. A card may emit zero, one,
 * or many tile instances per poster (e.g. `speciesMini` emits one tile per
 * species in the gallery). Eligibility lives inside the card's `build()`:
 * return `[]` to skip the card for the current data.
 *
 * Adding a new card type: append a new entry to {@link CARD_DEFS} — nothing
 * else changes. Removing one: delete its entry.
 *
 * Future hooks (not implemented yet — the shape is ready for them):
 *   - Priority / max-instance caps per card type for tight layouts.
 */
import type { ReactNode } from 'react'
import type { useLensData } from '../hooks/useLensData'
import type { Anchor } from '../lib/gridPacker'
import Globe from '../components/Globe'
import { seededPick, seededShuffle } from '../hooks/lensData/shared'
import { SPECIES_MINI_COUNT } from '../data/lensSelection'
import { IMAGE_SOURCE_LABELS } from '../api/speciesImage'
import { QRCodeSVG } from 'qrcode.react'
// NOTE: ~36 MB JSON; bundled into the main chunk for now. When this card
// graduates from the prototype, switch to a slimmed runtime payload or a
// dynamic import. The shape matches `precompute_comparison_sample.ipynb`.
import comparisonRaw from '../comparison_precompute.json'

/** Corner the tile should be hard-pinned to. Resolved against the current
 *  grid size in {@link BentoPoster} so `bottom-right` follows the height. */
export type PinCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Allowed tile sizes on the bento grid. The packer assumes 1..2 cells per axis. */
export type TileSize = { w: 1 | 2; h: 1 | 2 }

/** A single rendered card on the poster. */
export type Tile = {
  id: string
  w: 1 | 2
  h: 1 | 2
  /** Soft preference — packer tries this corner first but may place elsewhere. */
  anchor?: Anchor
  /** Hard pin — packer is forced to put the tile in this corner. */
  pin?: PinCorner
  /** Exact-cell pin (overrides `pin`). Used by the lock-card feature to
   *  freeze a tile to its previous placement across Regenerate. */
  pinXY?: { x: number; y: number }
  className: string
  render: () => ReactNode
  /** Stable slot identifier used by the per-card lock feature. Tiles
   *  without a slotId are not lockable (e.g. fillers). */
  slotId?: string
  /** Species ids (as in `SpeciesCardBase.id`) that this tile is showing.
   *  Used to prevent the same species appearing twice across the
   *  locked / freshly-generated boundary. */
  speciesIds?: string[]
}

type LensData = ReturnType<typeof useLensData>

/** Fixed poster dimensions. Size selection is intentionally removed. */
export const POSTER_GRID_W = 6
export const POSTER_GRID_H = 4
export const POSTER_GRID_AREA = POSTER_GRID_W * POSTER_GRID_H

/** What `buildBentoTiles` hands to each card. Lean on purpose. */
export type CardBuildCtx = {
  placeName: string
  latitude?: number
  longitude?: number
  /** Poster/content seed bumped by Regenerate; cards can key random picks to it. */
  contentSeed: number
  data: LensData
  /** Current shareable URL — encodes place + seed. Used by the sources QR. */
  shareUrl?: string
}

/** What a card's `build()` returns. Per-instance overrides are optional and
 *  only needed when one card type wants to vary size/placement/style per
 *  instance (e.g. alternating accents). */
export type TileInstance = {
  id: string
  render: () => ReactNode
  size?: TileSize
  anchor?: Anchor
  pin?: PinCorner
  className?: string  /** Stable identifier of the slot this instance fills. Survives content
   *  rotation (e.g. `mini-0` stays the same even when the species in slot
   *  0 changes). Required for tiles that should be lockable. */
  slotId?: string
  /** Species ids (matching `SpeciesCardBase.id`) shown by this tile. */
  speciesIds?: string[]}

/** Definition of a card type. */
export type CardDef = {
  /** Stable identifier for the card type. */
  type: string
  /** Default size for instances of this card. */
  size: TileSize
  /** Default placement hint. */
  anchor?: Anchor
  pin?: PinCorner
  /** Default className. */
  className: string
  /** Produce tile instances for the current context. Return `[]` to skip. */
  build: (ctx: CardBuildCtx) => TileInstance[]
}

// ───────────────────────────────────────────────────────────────────────────
// Render helpers shared by multiple cards.
// ───────────────────────────────────────────────────────────────────────────

const MONTH = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const fmtPct = (share: number) => {
  if (share >= 0.1) return `${Math.round(share * 100)}%`
  if (share >= 0.01) return `${(share * 100).toFixed(1)}%`
  return '<1%'
}

const sourceLabel = (source?: keyof typeof IMAGE_SOURCE_LABELS) =>
  source ? IMAGE_SOURCE_LABELS[source] : null

// ───────────────────────────────────────────────────────────────────────────
// Comparison precompute — lookup helpers for the "how this place compares"
// card. The notebook produces one row per curated city/country; here we
// resolve the *currently selected* place to its closest matching row.
// ───────────────────────────────────────────────────────────────────────────

type ComparisonPercentiles = {
  cohort: 'city' | 'country'
  cohortSize: number
  recordsPerKm2?: number | null
  uniqueSpecies?: number | null
  threatenedShare?: number | null
}

type ComparisonSignature = {
  speciesKey: number
  localCount: number
  globalCount: number
  localShare: number
  globalShare: number
  overRepresentationRatio: number
}

type ComparisonRow = {
  id: string
  kind: 'city' | 'country'
  place: {
    label: string
    latitude?: number | null
    longitude?: number | null
    bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null
  }
  percentiles?: ComparisonPercentiles | null
  signatureSpecies?: ComparisonSignature[] | null
}

const COMPARISON_ROWS = (comparisonRaw as { rows: ComparisonRow[] }).rows ?? []

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Resolve the currently selected place to a precomputed comparison row.
 *  Strategy: nearest city within 75 km (cohort=city), else country whose
 *  bbox contains the point (cohort=country). Returns `null` if neither
 *  matches — the card will then opt out. */
function findComparisonRow(
  latitude: number | undefined,
  longitude: number | undefined,
): ComparisonRow | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  let bestCity: ComparisonRow | null = null
  let bestCityDist = 75 // km cutoff
  for (const row of COMPARISON_ROWS) {
    if (row.kind !== 'city') continue
    const p = row.place
    if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue
    const d = haversineKm(latitude, longitude, p.latitude, p.longitude)
    if (d <= bestCityDist) {
      bestCityDist = d
      bestCity = row
    }
  }
  if (bestCity) return bestCity
  for (const row of COMPARISON_ROWS) {
    if (row.kind !== 'country') continue
    const bb = row.place.bbox
    if (!bb) continue
    if (
      latitude >= bb.minLat &&
      latitude <= bb.maxLat &&
      longitude >= bb.minLon &&
      longitude <= bb.maxLon
    ) {
      return row
    }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Card registry. Each entry is self-contained: type, size, placement, style,
// and a `build` that decides eligibility and produces tile instances.
// ───────────────────────────────────────────────────────────────────────────

export const CARD_DEFS: CardDef[] = [
  {
    type: 'title',
    size: { w: 2, h: 1 },
    pin: 'top-left',
    className: 'bento-card bento-card--title accent-gold',
    build: ({ placeName, latitude, longitude }) => [
      {
        id: 'title',
        slotId: 'title',
        render: () => (
          <div className="bento-title__layout">
            {typeof latitude === 'number' && typeof longitude === 'number' && (
              <Globe className="bento-title__globe" lat={latitude} lon={longitude} />
            )}
            <div className="bento-title__text">
              <h1 className="bento-title">
                <span className="bento-title__place">{placeName}</span>
                <span className="bento-title__sub">Biodiversity Portrait</span>
              </h1>
            </div>
          </div>
        ),
      },
    ],
  },

  {
    type: 'sightings',
    size: { w: 1, h: 2 },
    className: 'bento-card bento-card--sightings accent-ink',
    build: ({ data, latitude, longitude }) => {
      // Show the headline number plus the top 3 kingdoms as compact %
      // chips so users see the *composition* of those sightings, not just
      // the raw count. Falls back gracefully if breakdown is empty.
      const total = data.kingdomBreakdown.reduce((s, k) => s + k.count, 0)
      const topKingdoms = total > 0
        ? [...data.kingdomBreakdown]
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((k) => ({ label: k.label, share: k.count / total }))
        : []

      // IUCN buckets (merged from standalone card)
      const snap = data.conservationSnapshot
      const getIucn = (s: string) =>
        snap.categoryBreakdown.find((c) => c.status === s)?.count ?? 0
      const iucnBuckets = snap.totalAssessedSpecies > 0
        ? [
            { label: 'Doing well', count: getIucn('LC'), color: '#4ade80' },
            { label: 'Watch list', count: getIucn('NT') + getIucn('DD'), color: '#facc15' },
            { label: 'At risk', count: getIucn('VU') + getIucn('EN') + getIucn('CR'), color: '#f87171' },
          ]
        : []

      // Percentile context for the raw count: where does this place sit
      // against its peer cohort (cities or countries) from the precomputed
      // comparison sample? The 1×2 footprint gives room for two labelled
      // bars — recording intensity and threatened share — without
      // crowding the kingdom rows. This card now subsumes the old
      // standalone "How this place compares" tile.
      //
      // NOTE: `uniqueSpecies` is intentionally omitted. The metric in the
      // current `comparison_precompute.json` is saturated for ~94% of
      // places (the precompute used `len(species_counts)` with a 1000-row
      // facet cap). Once the notebook is rerun with paginated facet
      // counts, add a `{ key: 'species', label: 'Species richness', pct:
      // pcts.uniqueSpecies }` row to `ranks` below.
      const cmpRow = findComparisonRow(latitude, longitude)
      const pcts = cmpRow?.percentiles ?? null
      const cohortLabel = pcts?.cohort === 'city' ? 'cities' : 'countries'
      const cohortSize = pcts?.cohortSize
      const ranks = pcts
        ? [
            { key: 'records', label: 'Recording intensity', pct: pcts.recordsPerKm2 },
            { key: 'threat',  label: 'Threatened share',    pct: pcts.threatenedShare },
          ].filter((r): r is { key: string; label: string; pct: number } =>
            typeof r.pct === 'number' && Number.isFinite(r.pct),
          )
        : []
      const ordinal = (n: number) => {
        const v = n % 100
        if (v >= 11 && v <= 13) return `${n}th`
        switch (n % 10) {
          case 1: return `${n}st`
          case 2: return `${n}nd`
          case 3: return `${n}rd`
          default: return `${n}th`
        }
      }

      return [
        {
          id: 'sightings',
          slotId: 'sightings',
          render: () => (
            <>
              <span className="bento-card__kicker">Sightings on GBIF</span>
              <span className="bento-sightings__num">
                {data.totalRecords ? data.totalRecords.toLocaleString() : '—'}
              </span>
              {topKingdoms.length > 0 && (
                <ul className="bento-sightings__breakdown">
                  {topKingdoms.map((k) => (
                    <li key={k.label} className="bento-sightings__row">
                      <span className="bento-sightings__pct">{fmtPct(k.share)}</span>
                      <span className="bento-sightings__label">{k.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {iucnBuckets.length > 0 && (
                <div className="bento-sightings__iucn">
                  <span className="bento-sightings__iucn-head">IUCN Red List</span>
                  <div className="bento-sightings__iucn-pills">
                    {iucnBuckets.map((b) => (
                      <span key={b.label} className="bento-sightings__iucn-pill">
                        <span className="bento-sightings__iucn-dot" style={{ background: b.color }} />
                        <span className="bento-sightings__iucn-count">{b.count}</span>
                        <span className="bento-sightings__iucn-label">{b.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ranks.length > 0 && (
                <div className="bento-sightings__ranks">
                  <p className="bento-sightings__ranks-head">
                    How this place compares
                    {typeof cohortSize === 'number' && (
                      <span className="bento-sightings__ranks-sub">
                        {' '}· vs {cohortSize.toLocaleString()} {cohortLabel}
                      </span>
                    )}
                  </p>
                  <ul className="bento-sightings__rank-list">
                    {ranks.map((r) => {
                      const pctVal = Math.max(0, Math.min(1, r.pct)) * 100
                      return (
                        <li key={r.key} className="bento-sightings__rank">
                          <div className="bento-sightings__rank-head">
                            <span className="bento-sightings__rank-label">{r.label}</span>
                            <span className="bento-sightings__rank-pct">
                              {ordinal(Math.max(1, Math.round(pctVal)))} pct
                            </span>
                          </div>
                          <div
                            className="bento-sightings__bar"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pctVal)}
                            aria-label={`${r.label} percentile`}
                          >
                            <span
                              className="bento-sightings__bar-fill"
                              style={{ width: `${pctVal}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'hero',
    size: { w: 2, h: 2 },
    className: 'bento-card bento-card--hero accent-forest',
    build: ({ data }) => {
      const hero = data.topSpeciesData[0]
      if (!hero) return []
      return [
        {
          id: 'hero',
          slotId: 'hero',
          speciesIds: [hero.id],
          render: () => (
            <>
              {sourceLabel(hero.imageSource) && (
                <span className="bento-image-source-badge bento-image-source-badge--hero">
                  {sourceLabel(hero.imageSource)}
                </span>
              )}
              <img src={hero.imageUrl} alt={hero.commonName} className="bento-hero__img" loading="lazy" />
              <div className="bento-hero__body">
                <span className="bento-card__kicker">Most observed species</span>
                <h2 className="bento-hero__name">{hero.commonName}</h2>
                <p className="bento-hero__sci">{hero.scientificName}</p>
                {hero.taxonLine && <span className="bento-hero__taxon">{hero.taxonLine}</span>}
                {hero.popularity ? (
                  <span className="bento-hero__count">
                    {hero.popularity.toLocaleString()} observations
                  </span>
                ) : null}
              </div>
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'speciesMini',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini accent-paper',
    build: ({ data }) => {
      return data.topSpeciesData.slice(1, 1 + SPECIES_MINI_COUNT).map((sp, idx) => ({
        id: `sp-${sp.id}`,
        slotId: `mini-${idx}`,
        speciesIds: [sp.id],
        render: () => (
          <>
            <img src={sp.imageUrl} alt={sp.commonName} className="bento-mini__img" loading="lazy" />
            {sourceLabel(sp.imageSource) && (
              <span className="bento-image-source-badge">{sourceLabel(sp.imageSource)}</span>
            )}
            <span className="bento-mini__name">{sp.commonName}</span>
            <span className="bento-mini__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
            ) : null}
          </>
        ),
      }))
    },
  },

  {
    type: 'thematicStrip',
    size: { w: 1, h: 1 },
    // One species per thematic card, rendered like a `speciesMini` with the
    // theme kicker shown in the text section below the photo. Alternates the
    // accent so a row of these stays visually varied.
    className: 'bento-card bento-card--mini bento-card--thematic accent-gold',
    build: ({ data }) =>
      data.thematicStripCards
        .map((card, index) => {
          const sp = card.species[0]
          if (!sp) return null
          return {
            id: `thematic-${card.id}`,
            slotId: `thematic-${card.id}`,
            speciesIds: [sp.id],
            className:
              'bento-card bento-card--mini bento-card--thematic ' +
              (index % 2 === 0 ? 'accent-gold' : 'accent-forest'),
            render: () => (
              <>
                <img
                  src={sp.squareImageUrl ?? sp.imageUrl}
                  alt={sp.commonName}
                  className="bento-mini__img"
                  loading="lazy"
                />
                {sourceLabel(sp.imageSource) && (
                  <span className="bento-image-source-badge">{sourceLabel(sp.imageSource)}</span>
                )}
                <span className="bento-mini__name">{sp.commonName}</span>
                <span className="bento-mini__sci">{sp.scientificName}</span>
                {sp.popularity ? (
                  <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
                ) : null}
                <span className="bento-mini__ribbon">{card.kicker}</span>
              </>
            ),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
  },

  {
    type: 'seasonality',
    size: { w: 2, h: 1 },
    className: 'bento-card bento-card--season-how accent-paper',
    build: ({ data }) => {
      const ys = data.yearSummary
      const fmtCount = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
          : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
          : String(n)

      // Compute % of observations from the last 10 years
      const recentPct = (() => {
        if (!ys || ys.yearCounts.length < 2) return null
        const cutoff = new Date().getFullYear() - 9
        const total = ys.yearCounts.reduce((s, e) => s + e.count, 0)
        if (total === 0) return null
        const recent = ys.yearCounts
          .filter((e) => e.year >= cutoff)
          .reduce((s, e) => s + e.count, 0)
        return Math.round((recent / total) * 100)
      })()

      // How-we-know sources (merged from standalone card)
      const topRecords = data.recordsBreakdown.slice(0, 2)
      const restRecords = data.recordsBreakdown.slice(2)
      const restShare = restRecords.reduce((s, r) => s + r.share, 0)

      // Stacked-bar segments for "How we know": top-2 + optional rest bucket.
      type HowSeg = {
        key: string
        label: string
        share: number
        kind: 'primary' | 'secondary' | 'rest'
      }
      const howSegments: HowSeg[] = [
        ...topRecords.map((r, i) => ({
          key: r.key,
          label: (() => {
            switch (r.key) {
              case 'HUMAN_OBSERVATION':
                return 'Citizen science'
              case 'PRESERVED_SPECIMEN':
                return 'Museum + herbarium'
              case 'MATERIAL_SAMPLE':
                return 'Field samples'
              case 'MACHINE_OBSERVATION':
                return 'Cameras + sensors'
              case 'OBSERVATION':
                return 'Field observation'
              default:
                return r.label
            }
          })(),
          share: r.share,
          kind: (i === 0 ? 'primary' : 'secondary') as HowSeg['kind'],
        })),
        ...(restShare > 0.005
          ? [
              {
                key: '_rest',
                label: `${restRecords.length} other source${restRecords.length === 1 ? '' : 's'}`,
                share: restShare,
                kind: 'rest' as const,
              },
            ]
          : []),
      ]

      return [
        {
          id: 'seasonality',
          slotId: 'seasonality',
          render: () => (
            <div className="bento-season-how">
              <div className="bento-season-how__left">
                <div className="bento-season__header">
                  <span className="bento-card__kicker bento-card__kicker--season">Seasonality</span>
                  {ys && (
                    <span className="bento-season__since">
                      Records since {ys.firstYear}
                    </span>
                  )}
                </div>
                <div className="bento-season-bars" aria-label="Monthly observations">
                  {data.seasonalityData.map((val, i) => {
                    const ratio = data.maxSeasonality > 0 ? val / data.maxSeasonality : 0
                    return (
                      <div key={`m-${i}`} className="bento-season-bars__col">
                        <div className="bento-season-bars__track">
                          <div
                            className="bento-season-bars__bar"
                            style={{ height: `${Math.max(ratio * 100, 3)}%` }}
                            title={`${MONTH[i]} · ${fmtCount(val)}`}
                          />
                        </div>
                        <span className="bento-season-bars__label">{MONTH[i]}</span>
                      </div>
                    )
                  })}
                </div>
                {ys && (
                  <div className="bento-season__footer">
                    <span className="bento-season__stat">
                      Peak {ys.peakYear}: <strong>{fmtCount(ys.peakYearCount)}</strong> obs
                    </span>
                    {recentPct !== null && (
                      <>
                        <span className="bento-season__divider">·</span>
                        <span className="bento-season__stat">
                          <strong>{recentPct}%</strong> in last decade
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {howSegments.length > 0 && (
                <div className="bento-season-how__right">
                  <span className="bento-card__kicker bento-card__kicker--evidence">Evidence mix</span>
                  <div className="bento-how-stack">
                    <div className="bento-how-stack__bar" aria-hidden="true">
                      {howSegments.map((seg) => (
                        <div
                          key={seg.key}
                          className={`bento-how-stack__seg bento-how-stack__seg--${seg.kind}`}
                          style={{ flexGrow: Math.max(seg.share, 0.02) }}
                        />
                      ))}
                    </div>
                    <ul className="bento-how-stack__legend">
                      {howSegments.map((seg) => (
                        <li
                          key={seg.key}
                          className={`bento-how-stack__row bento-how-stack__row--${seg.kind}`}
                        >
                          <span className="bento-how-stack__pct">{fmtPct(seg.share)}</span>
                          <span className="bento-how-stack__label">{seg.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ),
        },
      ]
    },
  },

  {
    type: 'atRisk',
    size: { w: 1, h: 1 },
    className: 'bento-card bento-card--mini bento-card--at-risk accent-paper',
    build: ({ data, contentSeed }) => {
      const pool = data.conservationSnapshot.threatenedSpecies.filter(
        (sp) => sp.imageUrl,
      )
      if (pool.length === 0) return []
      const shuffled = seededShuffle(
        pool,
        `atRisk:${data.conservationSnapshot.threatenedSpecies[0]?.iucnCategory ?? 'x'}:${contentSeed}`,
      )
      return shuffled.slice(0, 2).map((sp, i) => ({
        id: `at-risk-${i}`,
        slotId: `at-risk-${i}`,
        speciesIds: [sp.id],
        render: () => (
          <>
            <img
              src={sp.squareImageUrl ?? sp.imageUrl}
              alt={sp.commonName}
              className="bento-mini__img"
              loading="lazy"
            />
            {sourceLabel(sp.imageSource) && (
              <span className="bento-image-source-badge">{sourceLabel(sp.imageSource)}</span>
            )}
            <span className="bento-mini__name">{sp.commonName}</span>
            <span className="bento-mini__sci">{sp.scientificName}</span>
            {sp.popularity ? (
              <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
            ) : null}
            <span className="bento-mini__ribbon bento-mini__ribbon--danger">
              At risk · {sp.iucnCategory}
            </span>
          </>
        ),
      }))
    },
  },

  // Signature species — one species over-represented in this place vs the
  // global GBIF baseline. Renders as a 1×1 species card (same visual
  // language as `speciesMini` / `atRisk`) with a ratio chip. The pool is
  // built by `useLiveSignatureSpecies` and trimmed by
  // `dedupeSpeciesAcrossLenses`, so the pick here can never duplicate the
  // hero, an at-risk species, or a thematic strip species. The hook now
  // returns a class-diverse top-3 pool; this card picks one using the
  // current content seed so Regenerate rotates within that pool.
  {
    type: 'signatureSpecies',
    size: { w: 1, h: 1 },
    className:
      'bento-card bento-card--mini bento-card--signature accent-forest',
    build: ({ data, placeName, latitude, longitude, contentSeed }) => {
      const pool = data.signatureSpeciesData.filter((sp) => sp.imageUrl)
      if (pool.length === 0) return []
      const sp = seededPick(
        pool,
        `signature:${placeName}:${latitude ?? ''}:${longitude ?? ''}:${contentSeed}`,
      )
      const r = sp.overRepresentationRatio
      const ratioLabel =
        r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`
      return [
        {
          id: 'signature-species',
          slotId: 'signature-species',
          speciesIds: [sp.id],
          render: () => (
            <>
              <img
                src={sp.squareImageUrl ?? sp.imageUrl}
                alt={sp.commonName}
                className="bento-mini__img"
                loading="lazy"
              />
              {sourceLabel(sp.imageSource) && (
                <span className="bento-image-source-badge">{sourceLabel(sp.imageSource)}</span>
              )}
              <span className="bento-mini__ribbon bento-mini__ribbon--signature">
                Signature · {ratioLabel}
              </span>
              <span className="bento-mini__name">{sp.commonName}</span>
              <span className="bento-mini__sci">{sp.scientificName}</span>
              {sp.popularity ? (
                <span className="bento-mini__count">{sp.popularity.toLocaleString()}</span>
              ) : null}
            </>
          ),
        },
      ]
    },
  },

  {
    type: 'sources',
    size: { w: 2, h: 1 },
    pin: 'bottom-right',
    className: 'bento-card accent-gold bento-sources',
    build: ({ data, shareUrl }) => [
      {
        id: 'sources',
        slotId: 'sources',
        render: () => (
          <>
            <div className="bento-sources__text">
              <span className="bento-card__kicker">Sources</span>
              <p className="bento-card__sub">
                <strong>GBIF</strong> · <strong>Lynxee</strong>
              </p>
              {data.datasetSummaries.length > 0 && (
                <p className="bento-datasets">{data.datasetSummaries[0]?.title}</p>
              )}
            </div>
            {shareUrl && (
              <div className="bento-sources__qr" aria-label="Scan to open this poster">
                <QRCodeSVG
                  value={shareUrl}
                  size={180}
                  bgColor="transparent"
                  fgColor="#1a1a1a"
                  level="H"
                  marginSize={0}
                />
              </div>
            )}
          </>
        ),
      },
    ],
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Public API used by the poster page.
// ───────────────────────────────────────────────────────────────────────────

export interface BuildTilesArgs {
  placeName: string
  /** Latitude of the selected place (degrees). Used by the title-tile globe. */
  latitude?: number
  /** Longitude of the selected place (degrees). Used by the title-tile globe. */
  longitude?: number
  data: LensData
  /** Regenerate seed used for tile-level random picks (species cards, etc.). */
  contentSeed: number
  /** Current shareable URL (place + seed). Used by the sources QR. */
  shareUrl?: string
}

/** Walk the card registry and produce concrete tiles for the current data. */
export function buildBentoTiles(args: BuildTilesArgs): Tile[] {
  const ctx: CardBuildCtx = args
  const tiles: Tile[] = []
  const areaBudget = POSTER_GRID_AREA
  let usedArea = 0
  for (const def of CARD_DEFS) {
    for (const inst of def.build(ctx)) {
      const w = inst.size?.w ?? def.size.w
      const h = inst.size?.h ?? def.size.h
      const area = w * h
      // Fixed-size poster should not grow when new cards are added.
      // Skip overflow tiles in registry order.
      if (usedArea + area > areaBudget) continue
      tiles.push({
        id: inst.id,
        w,
        h,
        anchor: inst.anchor ?? def.anchor,
        pin: inst.pin ?? def.pin,
        className: inst.className ?? def.className,
        render: inst.render,
        slotId: inst.slotId,
        speciesIds: inst.speciesIds,
      })
      usedArea += area
    }
  }
  return tiles
}

/** Pad with invisible 1×1 fillers. When `targetArea` is set, pad up to that
 *  exact total area (used by the fixed 6×4 poster).
 *  Otherwise, pad to the next multiple of `gridW` so a rectangle can be
 *  tiled with no leftover. */
export function padToRectangle(
  tiles: Tile[],
  gridW: number,
  targetArea?: number,
): Tile[] {
  const totalArea = tiles.reduce((s, t) => s + t.w * t.h, 0)
  let fillerCount: number
  if (typeof targetArea === 'number') {
    fillerCount = Math.max(0, targetArea - totalArea)
  } else {
    const remainder = totalArea % gridW
    if (remainder === 0) return tiles
    fillerCount = gridW - remainder
  }
  if (fillerCount === 0) return tiles
  const fillers: Tile[] = Array.from({ length: fillerCount }, (_, i) => ({
    id: `filler-${i}`,
    w: 1,
    h: 1,
    className: 'bento-card bento-card--filler',
    render: () => null,
  }))
  return [...tiles, ...fillers]
}
