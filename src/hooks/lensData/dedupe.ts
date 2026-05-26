/**
 * Cross-lens species deduplication.
 *
 * Each lens (top species, conservation, thematic) fetches its own
 * candidate pool independently. Without coordination, the same species
 * can appear as the hero, as an at-risk pick, and inside a thematic
 * strip.
 *
 * This pass runs once over the assembled `LensData` and enforces a single
 * fixed priority order — earlier slots win, later slots fall through to
 * their next candidate. Every lens exposes a *list* of candidates so a
 * fall-through is just an array filter (no extra network calls).
 *
 * Priority (most prominent → least):
 *   1. `topSpeciesData`        — hero tile + mini gallery (claims all)
 *   2. `threatenedSpecies`     — at-risk card (claims the survivor it renders)
 *   3. `thematicStripCards[*]` — themed strips, processed in array order;
 *                                first `MAX_THEMATIC_STRIPS` with non-empty
 *                                survivors are kept.
 *   4. `signatureSpeciesData`  — pool for the signature-species card.
 *                                Filtered against everything above so the
 *                                random pick never duplicates a species
 *                                already shown elsewhere on the poster.
 *
 * Adding a new lens: insert it into the chain at the right priority and
 * make sure the hook returns multiple candidates so dedup can fall
 * through.
 */
import type { LensData } from './types'

const MAX_THEMATIC_STRIPS = 2

export const dedupeSpeciesAcrossLenses = (data: LensData): LensData => {
  const claimed = new Set<string>()

  // 1. Top species (hero + minis): claim everything in the gallery.
  for (const sp of data.topSpeciesData) claimed.add(sp.id)

  // 2. At-risk: filter the threatened list, claim all survivors so no
  //    downstream card duplicates them (2 are rendered, but the pool is
  //    small so claiming all is safe).
  const threatenedSpecies = data.conservationSnapshot.threatenedSpecies
    .filter((sp) => !claimed.has(sp.id))
  for (const sp of threatenedSpecies) claimed.add(sp.id)

  // 3. Thematic strips: keep only themes that still have a renderable
  //    species[0] after filtering, up to MAX_THEMATIC_STRIPS.
  const thematicStripCards: LensData['thematicStripCards'] = []
  for (const card of data.thematicStripCards) {
    const species = card.species.filter((sp) => !claimed.has(sp.id))
    if (species.length === 0) continue
    claimed.add(species[0].id)
    thematicStripCards.push({ ...card, species })
    if (thematicStripCards.length >= MAX_THEMATIC_STRIPS) break
  }

  // 4. Signature species: pass through the survivors so the card can pick
  //    one at random from a clean pool. We don't claim here — there's no
  //    lower-priority lens that would conflict.
  const signatureSpeciesData = data.signatureSpeciesData.filter(
    (sp) => !claimed.has(sp.id),
  )

  return {
    ...data,
    conservationSnapshot: {
      ...data.conservationSnapshot,
      threatenedSpecies,
    },
    thematicStripCards,
    signatureSpeciesData,
  }
}
