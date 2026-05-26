import type { GbifSpecies } from '../../api/gbif'
import { fetchSpecies } from '../../api/gbif'
import type { SpeciesCard } from '../../types/lens'

/** Build the common SpeciesCard fields from a resolved GBIF species record. */
export const speciesCardBase = (
  speciesKey: number,
  species: GbifSpecies,
): Omit<SpeciesCard, 'highlight'> => ({
  id: String(speciesKey),
  commonName:
    species.vernacularName ?? species.canonicalName ?? species.scientificName,
  scientificName: species.scientificName,
  canonicalName: species.canonicalName ?? species.scientificName,
  imageUrl: '',
  taxonLine: [species.kingdom, species.phylum, species.class]
    .filter(Boolean)
    .join(' · '),
})

export type SpeciesPick = {
  speciesKey: number
  count: number
  highlight: string
}

export const resolveSpeciesCards = async (
  picks: SpeciesPick[],
  signal: AbortSignal | undefined,
): Promise<SpeciesCard[]> => {
  return Promise.all(
    picks.map(async (item) => {
      const species = await fetchSpecies({ speciesKey: item.speciesKey, signal })
      return {
        ...speciesCardBase(item.speciesKey, species),
        highlight: item.highlight,
        popularity: item.count,
      }
    }),
  )
}