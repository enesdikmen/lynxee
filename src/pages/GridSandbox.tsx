import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './GridSandbox.css'
import {
  packWithRetries,
  type Anchor,
  type BoxSpec,
} from '../lib/gridPacker'

// ── Demo box palette ────────────────────────────────────────────────────
const SIZE_OPTIONS: Array<{ label: string; w: number; h: number }> = [
  { label: '1×1', w: 1, h: 1 },
  { label: '1×2 (wide)',  w: 2, h: 1 },
  { label: '2×1 (tall)',  w: 1, h: 2 },
  { label: '2×2', w: 2, h: 2 },
  { label: '3×2', w: 3, h: 2 },
]

const ANCHOR_OPTIONS: Array<{ label: string; value: Anchor | '' }> = [
  { label: 'free',         value: '' },
  { label: 'top-left',     value: 'top-left' },
  { label: 'top-right',    value: 'top-right' },
  { label: 'bottom-left',  value: 'bottom-left' },
  { label: 'bottom-right', value: 'bottom-right' },
  { label: 'top',          value: 'top' },
  { label: 'bottom',       value: 'bottom' },
  { label: 'left',         value: 'left' },
  { label: 'right',        value: 'right' },
]

const PALETTE = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#8338ec', '#fb8500', '#a8dadc', '#e07a5f']

const colorFor = (i: number) => PALETTE[i % PALETTE.length]

interface Props {
  onBack: () => void
}

interface EditableBox extends BoxSpec {
  anchor: Anchor | ''
  pinX: number | null
  pinY: number | null
}

const initialBoxes = (): EditableBox[] => [
  { id: 'title',  label: 'Title',  w: 2, h: 1, anchor: 'top-left', pinX: null, pinY: null },
  { id: 'hero',   label: 'Hero',   w: 2, h: 2, anchor: '',         pinX: null, pinY: null },
  { id: 'chart',  label: 'Chart',  w: 2, h: 1, anchor: 'bottom',   pinX: null, pinY: null },
  { id: 'card-1', label: 'Card 1', w: 1, h: 1, anchor: '',         pinX: null, pinY: null },
  { id: 'card-2', label: 'Card 2', w: 1, h: 1, anchor: '',         pinX: null, pinY: null },
  { id: 'card-3', label: 'Card 3', w: 1, h: 1, anchor: '',         pinX: null, pinY: null },
  { id: 'card-4', label: 'Card 4', w: 1, h: 1, anchor: '',         pinX: null, pinY: null },
  { id: 'card-5', label: 'Card 5', w: 1, h: 1, anchor: '',         pinX: null, pinY: null },
]

export default function GridSandbox({ onBack }: Props) {
  const [width, setWidth] = useState(4)
  const [height, setHeight] = useState(4)
  const [boxes, setBoxes] = useState<EditableBox[]>(initialBoxes)
  const [seed, setSeed] = useState(1)
  const [nextId, setNextId] = useState(100)
  const [newSize, setNewSize] = useState(0)

  const totalBoxArea = boxes.reduce((s, b) => s + b.w * b.h, 0)
  const gridArea = width * height
  const feasibleArea = totalBoxArea <= gridArea

  const specs = useMemo<BoxSpec[]>(
    () =>
      boxes.map((b) => {
        const pin =
          b.pinX !== null && b.pinY !== null
            ? { x: b.pinX, y: b.pinY }
            : undefined
        return {
          id: b.id,
          label: b.label,
          w: b.w,
          h: b.h,
          constraint: {
            ...(pin ? { pin } : {}),
            ...(b.anchor ? { anchor: b.anchor as Anchor } : {}),
          },
        }
      }),
    [boxes],
  )

  const result = useMemo(
    () => (feasibleArea ? packWithRetries({ width, height, boxes: specs, seed }, 30) : null),
    [width, height, specs, seed, feasibleArea],
  )

  const colorById = useMemo(() => {
    const m = new Map<string, string>()
    boxes.forEach((b, i) => m.set(b.id, colorFor(i)))
    return m
  }, [boxes])

  const updateBox = (id: string, patch: Partial<EditableBox>) =>
    setBoxes((xs) => xs.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const removeBox = (id: string) =>
    setBoxes((xs) => xs.filter((b) => b.id !== id))

  const addBox = () => {
    const size = SIZE_OPTIONS[newSize]
    const id = `box-${nextId}`
    setNextId(nextId + 1)
    setBoxes((xs) => [
      ...xs,
      { id, label: `Box ${nextId}`, w: size.w, h: size.h, anchor: '', pinX: null, pinY: null },
    ])
  }

  return (
    <div className="sandbox-shell">
      <div className="sandbox-topbar">
        <h1>Layout Lab — packer sandbox</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="sandbox-btn sandbox-btn--primary" onClick={() => setSeed((s) => s + 1)}>
            ↻ Regenerate
          </button>
          <button className="sandbox-btn sandbox-btn--ghost" onClick={onBack}>← Back</button>
        </div>
      </div>

      <div className="sandbox-layout">
        {/* ── Canvas ── */}
        <div className="sandbox-canvas-wrap">
          {!feasibleArea && (
            <div className="sandbox-status sandbox-status--bad">
              Boxes total {totalBoxArea} cells but grid is only {gridArea}. Shrink or remove some.
            </div>
          )}
          {feasibleArea && !result && (
            <div className="sandbox-status sandbox-status--bad">
              Constraints make this layout impossible. Try relaxing pins/anchors.
            </div>
          )}
          {result && (
            <div className="sandbox-status sandbox-status--ok">
              Placed {result.placements.length} boxes · {result.empty.length} empty cells · seed {seed}
            </div>
          )}

          <div
            className="sandbox-canvas"
            style={{
              gridTemplateColumns: `repeat(${width}, 1fr)`,
              gridTemplateRows: `repeat(${height}, 1fr)`,
              ['--ratio' as string]: `${width} / ${height}`,
              marginTop: '0.75rem',
            }}
          >
            <AnimatePresence>
              {result?.placements.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  className="sandbox-tile"
                  style={{
                    gridColumn: `${p.x + 1} / span ${p.w}`,
                    gridRow:    `${p.y + 1} / span ${p.h}`,
                    ['--tile-bg' as string]: colorById.get(p.id) ?? '#e9e4da',
                  }}
                >
                  <span>{p.label ?? p.id}</span>
                  <small>{p.w}×{p.h}</small>
                </motion.div>
              ))}
            </AnimatePresence>

            {result?.empty.map((c) => (
              <div
                key={`e-${c.x}-${c.y}`}
                className="sandbox-tile sandbox-tile--empty"
                style={{
                  gridColumn: `${c.x + 1} / span 1`,
                  gridRow:    `${c.y + 1} / span 1`,
                }}
              >
                <small>empty</small>
              </div>
            ))}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="sandbox-panel">
          <section>
            <h2>Grid</h2>
            <div className="sandbox-row">
              <label>
                width
                <input
                  type="number" min={1} max={12} value={width}
                  onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label>
                height
                <input
                  type="number" min={1} max={12} value={height}
                  onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label>
                seed
                <input
                  type="number" value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          <section>
            <h2>Boxes ({boxes.length})</h2>
            <div className="box-list">
              {boxes.map((b, i) => (
                <div key={b.id} className="box-row">
                  <span className="box-row__swatch" style={{ background: colorFor(i) }} />
                  <div className="box-row__main">
                    <input
                      className="box-row__title"
                      value={b.label ?? ''}
                      onChange={(e) => updateBox(b.id, { label: e.target.value })}
                      style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 700 }}
                    />
                    <div className="box-row__sub">
                      <select
                        value={`${b.w}x${b.h}`}
                        onChange={(e) => {
                          const [w, h] = e.target.value.split('x').map(Number)
                          updateBox(b.id, { w, h })
                        }}
                        title="size"
                      >
                        {SIZE_OPTIONS.map((s) => (
                          <option key={s.label} value={`${s.w}x${s.h}`}>{s.label}</option>
                        ))}
                      </select>
                      <select
                        value={b.anchor}
                        onChange={(e) => updateBox(b.id, { anchor: e.target.value as Anchor | '' })}
                        title="anchor preference"
                      >
                        {ANCHOR_OPTIONS.map((a) => (
                          <option key={a.label} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      <span title="pin to exact x,y (blank = unpinned)">
                        pin
                        <input
                          type="number" min={0} placeholder="x" style={{ width: 38, marginLeft: 4 }}
                          value={b.pinX ?? ''}
                          onChange={(e) =>
                            updateBox(b.id, { pinX: e.target.value === '' ? null : Number(e.target.value) })
                          }
                        />
                        <input
                          type="number" min={0} placeholder="y" style={{ width: 38, marginLeft: 2 }}
                          value={b.pinY ?? ''}
                          onChange={(e) =>
                            updateBox(b.id, { pinY: e.target.value === '' ? null : Number(e.target.value) })
                          }
                        />
                      </span>
                    </div>
                  </div>
                  <button
                    className="box-row__remove"
                    onClick={() => removeBox(b.id)}
                    title="remove"
                  >×</button>
                </div>
              ))}
            </div>

            <div className="add-box" style={{ marginTop: '0.6rem' }}>
              <select value={newSize} onChange={(e) => setNewSize(Number(e.target.value))}>
                {SIZE_OPTIONS.map((s, i) => (
                  <option key={s.label} value={i}>{s.label}</option>
                ))}
              </select>
              <button className="sandbox-btn" onClick={addBox}>+ add box</button>
            </div>
          </section>

          <section style={{ fontSize: '0.75rem', opacity: 0.75, lineHeight: 1.45 }}>
            <strong>How it works:</strong> seeded backtracking places largest boxes first,
            then smaller ones, trying random positions until a valid layout fits.
            <em> Anchor</em> biases a box toward an edge/corner; <em>pin</em> forces an exact cell.
          </section>
        </div>
      </div>
    </div>
  )
}
