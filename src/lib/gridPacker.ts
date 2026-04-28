/**
 * gridPacker — seeded backtracking placement of rectangular boxes on a fixed grid.
 *
 * Algorithm: largest-first + shuffled candidates with backtracking.
 * - Pinned boxes are placed first (hard positions).
 * - Remaining boxes are sorted by area DESC; at each step we try every empty
 *   (x,y) where the box fits, in a seed-shuffled order.
 * - On dead-end, we backtrack. Guarantees a valid layout if one exists.
 *
 * Pure & deterministic given the same `seed`.
 */

export type BoxSize = { w: number; h: number }

export interface BoxConstraint {
  /** Force this position (x,y). If set, box is "pinned". */
  pin?: { x: number; y: number }
  /** Restrict to a sub-region [x0..x1) × [y0..y1). */
  region?: { x0: number; y0: number; x1: number; y1: number }
  /** "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top" | "bottom" | "left" | "right" */
  anchor?: Anchor
}

export type Anchor =
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'top' | 'bottom' | 'left' | 'right'

export interface BoxSpec {
  id: string
  /** Display label for the demo. */
  label?: string
  w: number
  h: number
  constraint?: BoxConstraint
}

export interface Placement {
  id: string
  label?: string
  x: number
  y: number
  w: number
  h: number
}

export interface PackInput {
  width: number
  height: number
  boxes: BoxSpec[]
  seed: number
}

export interface PackResult {
  placements: Placement[]
  /** Cells that ended up empty. */
  empty: Array<{ x: number; y: number }>
  width: number
  height: number
}

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Grid helpers ─────────────────────────────────────────────────────────
type Grid = Uint8Array
const idx = (W: number, x: number, y: number) => y * W + x

function fits(grid: Grid, W: number, H: number, x: number, y: number, w: number, h: number) {
  if (x < 0 || y < 0 || x + w > W || y + h > H) return false
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      if (grid[idx(W, x + dx, y + dy)]) return false
  return true
}

function mark(grid: Grid, W: number, x: number, y: number, w: number, h: number, v: 0 | 1) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      grid[idx(W, x + dx, y + dy)] = v
}

// Anchor → sort key for candidate ordering (smaller = preferred).
function anchorKey(anchor: Anchor | undefined, x: number, y: number, W: number, H: number): number {
  switch (anchor) {
    case 'top-left':     return y * W + x
    case 'top-right':    return y * W + (W - x)
    case 'bottom-left':  return (H - y) * W + x
    case 'bottom-right': return (H - y) * W + (W - x)
    case 'top':          return y
    case 'bottom':       return H - y
    case 'left':         return x
    case 'right':        return W - x
    default:             return 0
  }
}

function candidatesFor(
  spec: BoxSpec,
  grid: Grid,
  W: number,
  H: number,
  rnd: () => number,
): Array<{ x: number; y: number }> {
  const c = spec.constraint
  const r = c?.region
  const x0 = Math.max(0, r?.x0 ?? 0)
  const y0 = Math.max(0, r?.y0 ?? 0)
  const x1 = Math.min(W, r?.x1 ?? W)
  const y1 = Math.min(H, r?.y1 ?? H)

  const list: Array<{ x: number; y: number }> = []
  for (let y = y0; y <= y1 - spec.h; y++)
    for (let x = x0; x <= x1 - spec.w; x++)
      if (fits(grid, W, H, x, y, spec.w, spec.h)) list.push({ x, y })

  if (c?.anchor) {
    // Stable jitter: anchor key with a tiny random tiebreak so multiple equally-good
    // anchored positions still vary between seeds.
    return list
      .map((p) => ({ p, k: anchorKey(c.anchor, p.x, p.y, W, H) + rnd() * 0.01 }))
      .sort((a, b) => a.k - b.k)
      .map((e) => e.p)
  }
  return shuffle(list, rnd)
}

// ── Main entry ───────────────────────────────────────────────────────────
export function pack({ width, height, boxes, seed }: PackInput): PackResult | null {
  const W = width, H = height
  const grid: Grid = new Uint8Array(W * H)
  const rnd = mulberry32(seed)

  const placements: Placement[] = []

  // 1. Place pinned boxes first.
  const pinned = boxes.filter((b) => b.constraint?.pin)
  for (const b of pinned) {
    const { x, y } = b.constraint!.pin!
    if (!fits(grid, W, H, x, y, b.w, b.h)) return null
    mark(grid, W, x, y, b.w, b.h, 1)
    placements.push({ id: b.id, label: b.label, x, y, w: b.w, h: b.h })
  }

  // 2. Sort remaining by area DESC, then shuffled within ties.
  const rest = boxes.filter((b) => !b.constraint?.pin)
  const buckets = new Map<number, BoxSpec[]>()
  for (const b of rest) {
    const a = b.w * b.h
    if (!buckets.has(a)) buckets.set(a, [])
    buckets.get(a)!.push(b)
  }
  const ordered: BoxSpec[] = []
  for (const area of [...buckets.keys()].sort((a, b) => b - a)) {
    ordered.push(...shuffle(buckets.get(area)!, rnd))
  }

  // 3. Backtracking.
  function solve(i: number): boolean {
    if (i >= ordered.length) return true
    const spec = ordered[i]
    const cands = candidatesFor(spec, grid, W, H, rnd)
    for (const { x, y } of cands) {
      mark(grid, W, x, y, spec.w, spec.h, 1)
      placements.push({ id: spec.id, label: spec.label, x, y, w: spec.w, h: spec.h })
      if (solve(i + 1)) return true
      placements.pop()
      mark(grid, W, x, y, spec.w, spec.h, 0)
    }
    return false
  }

  if (!solve(0)) return null

  // 4. Collect empty cells.
  const empty: Array<{ x: number; y: number }> = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!grid[idx(W, x, y)]) empty.push({ x, y })

  return { placements, empty, width: W, height: H }
}

/** Try multiple seeds in case constraints are very tight. */
export function packWithRetries(
  input: PackInput,
  retries = 20,
): PackResult | null {
  for (let i = 0; i < retries; i++) {
    const r = pack({ ...input, seed: input.seed + i * 7919 })
    if (r) return r
  }
  return null
}
