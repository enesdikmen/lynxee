import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { resolveSpeciesImage, type ImageSource } from '../../api/speciesImage'
import type {
  ConservationSnapshot,
  SpeciesCard,
  ThematicStripCard,
} from '../../types/lens'
import type { SignatureSpeciesCard } from './signatureSpecies'

export type UseLensImageOverlayArgs = {
  topSpeciesData: SpeciesCard[]
  thematicStripCards: ThematicStripCard[]
  conservationSnapshot: ConservationSnapshot
  signatureSpeciesData: SignatureSpeciesCard[]
  imageSources: ImageSource[]
}

export type UseLensImageOverlayResult = {
  topSpeciesData: SpeciesCard[]
  thematicStripCards: ThematicStripCard[]
  conservationSnapshot: ConservationSnapshot
  signatureSpeciesData: SignatureSpeciesCard[]
  isReady: boolean
}

export const useLensImageOverlay = (
  args: UseLensImageOverlayArgs,
): UseLensImageOverlayResult => {
  const {
    topSpeciesData,
    thematicStripCards,
    conservationSnapshot,
    signatureSpeciesData,
    imageSources,
  } = args

  const speciesForImaging = useMemo(() => {
    const map = new Map<number, { speciesKey: number; canonicalName?: string }>()
    const collect = (cards: SpeciesCard[] | undefined) => {
      cards?.forEach((c) => {
        const key = Number(c.id)
        if (!Number.isFinite(key) || map.has(key)) return
        if (c.imageUrl) return
        map.set(key, { speciesKey: key, canonicalName: c.canonicalName })
      })
    }
    collect(topSpeciesData)
    thematicStripCards.forEach((card) => collect(card.species))
    collect(conservationSnapshot.threatenedSpecies)
    collect(signatureSpeciesData)
    return Array.from(map.values()).sort((a, b) => a.speciesKey - b.speciesKey)
  }, [
    topSpeciesData,
    thematicStripCards,
    conservationSnapshot.threatenedSpecies,
    signatureSpeciesData,
  ])

  const imageMapQuery = useQuery({
    queryKey: [
      'speciesImages',
      speciesForImaging.map((s) => s.speciesKey).join(','),
      imageSources.join(','),
    ],
    queryFn: async () => {
      const map = new Map<
        number,
        { url: string; squareUrl?: string; source: ImageSource }
      >()
      if (imageSources.length === 0) return map
      // Single fast pass. We deliberately do NOT block here on retries —
      // doing so would freeze Regenerate behind the slowest source. Any
      // species still missing after this pass is picked up by the
      // background retry effect below, which calls `refetch` after a
      // backoff. The fetcher cache in `speciesImage.ts` evicts null
      // outcomes, so each refetch re-attempts the source chain from
      // scratch and successful hits accumulate across passes.
      await Promise.all(
        speciesForImaging.map(async ({ speciesKey, canonicalName }) => {
          const img = await resolveSpeciesImage({
            speciesKey,
            scientificName: canonicalName,
            sources: imageSources,
          })
          if (img?.url) {
            map.set(speciesKey, {
              url: img.url,
              squareUrl: img.squareUrl,
              source: img.source,
            })
          }
        }),
      )
      return map
    },
    enabled: speciesForImaging.length > 0,
    // Keep already-resolved URLs visible while a new species-set key
    // fetches so unchanged cards don't flash placeholders on Regenerate.
    placeholderData: (previousData) => previousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  })

  const imageMap = imageMapQuery.data

  // Background retry for share-link fidelity. When the first pass leaves
  // species without images (typical for a freshly opened share URL where
  // Wikidata/iNat momentarily rate-limit), we refetch with exponential
  // backoff up to MAX_RETRIES. Successful hits cached in
  // `speciesImage.ts` are reused instantly, so each retry only re-attempts
  // genuinely missing species. The UI keeps rendering with whatever
  // images we have so Regenerate stays snappy.
  const retryCountRef = useRef(0)
  const retryKeyRef = useRef<string>('')
  const speciesKeyJoined = useMemo(
    () => speciesForImaging.map((s) => s.speciesKey).join(','),
    [speciesForImaging],
  )
  const sourcesJoined = useMemo(() => imageSources.join(','), [imageSources])

  useEffect(() => {
    const key = `${speciesKeyJoined}|${sourcesJoined}`
    if (retryKeyRef.current !== key) {
      retryKeyRef.current = key
      retryCountRef.current = 0
    }
  }, [speciesKeyJoined, sourcesJoined])

  useEffect(() => {
    if (!imageMapQuery.isSuccess) return
    if (imageMapQuery.isPlaceholderData) return
    if (imageSources.length === 0 || speciesForImaging.length === 0) return
    const MAX_RETRIES = 3
    const DELAYS_MS = [600, 1500, 3500]
    if (retryCountRef.current >= MAX_RETRIES) return
    const missing = speciesForImaging.filter(
      (s) => !imageMap?.has(s.speciesKey),
    )
    if (missing.length === 0) return
    const delay = DELAYS_MS[retryCountRef.current] ?? 3500
    const timer = window.setTimeout(() => {
      retryCountRef.current += 1
      void imageMapQuery.refetch()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [imageMapQuery, imageMap, speciesForImaging, imageSources])

  const applyImage = useMemo(() => {
    return <T extends SpeciesCard>(card: T): T => {
      const img = imageMap?.get(Number(card.id))
      if (!img) return card
      return {
        ...card,
        imageUrl: img.url,
        squareImageUrl: img.squareUrl,
        imageSource: img.source,
      }
    }
  }, [imageMap])

  const imagedTopSpecies = useMemo(
    () => topSpeciesData.map(applyImage),
    [topSpeciesData, applyImage],
  )
  const imagedThematicStripCards = useMemo(
    () =>
      thematicStripCards.map((c) => ({
        ...c,
        species: c.species.map(applyImage),
      })),
    [thematicStripCards, applyImage],
  )
  const imagedConservationSnapshot = useMemo(
    () => ({
      ...conservationSnapshot,
      threatenedSpecies: conservationSnapshot.threatenedSpecies.map(applyImage),
    }),
    [conservationSnapshot, applyImage],
  )
  const imagedSignatureSpecies = useMemo(
    () => signatureSpeciesData.map(applyImage),
    [signatureSpeciesData, applyImage],
  )

  const isReady =
    speciesForImaging.length === 0 ||
    (imageMapQuery.isSuccess && !imageMapQuery.isPlaceholderData) ||
    imageMapQuery.isError

  return {
    topSpeciesData: imagedTopSpecies,
    thematicStripCards: imagedThematicStripCards,
    conservationSnapshot: imagedConservationSnapshot,
    signatureSpeciesData: imagedSignatureSpecies,
    isReady,
  }
}
