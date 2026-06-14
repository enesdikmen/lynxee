# How Bee Around Works

Bee Around creates a biodiversity poster for one selected place. The poster is intentionally compact: it gives a reader a strong first impression, then provides links, credits, and caveats so they can inspect the underlying data trail.

The app is exploratory rather than fixed-report oriented. A single place can produce many valid posters because there is usually more GBIF data than can fit in 24 grid cells.

## Place Search And Area Selection

Place search uses OpenStreetMap Nominatim:

```text
GET https://nominatim.openstreetmap.org/search
  ?format=json
  &q={query}
  &limit=6
  &addressdetails=1
  &accept-language={language}
  &featuretype=city
```

The app sends the same language as the interface in `accept-language` and as an `Accept-Language` header. Results are deduplicated by normalized city name plus country. If both ordinary city and administrative-boundary variants appear for the same label, the administrative result is preferred because it usually gives a more useful area box.

Each selected place stores:

- `label`: short visible label such as `Munich, DE`;
- `latitude` and `longitude`: used for the title globe and share token;
- `countryCode`: ISO-2 code when Nominatim supplies one;
- `radiusKm`: fallback search radius, normally 35 km for searched places;
- `bbox`: Nominatim bounding box when available, as `minLat`, `maxLat`, `minLon`, `maxLon`.

GBIF area selection is:

- Prefer the Nominatim `bbox`.
- If no `bbox` exists, convert `radiusKm` to a latitude/longitude box around the point using 110.574 km per degree latitude and `111.32 * cos(latitude)` km per degree longitude.
- If a `bbox` is very large and a valid country code exists, use GBIF `country=XX` instead of latitude/longitude ranges. "Very large" means latitude span at least 20 degrees or longitude span at least 40 degrees.

This is good for a public poster, not a legal boundary analysis. Record coordinates, Nominatim boundaries, and GBIF indexing all have their own precision limits.

## GBIF Request Pattern

All GBIF calls use `https://api.gbif.org/v1`. Occurrence summaries use:

```text
GET /occurrence/search?limit=0&facet=...
```

`limit=0` keeps payloads small while still returning the total `count` and facet counts. The app does not download all matching records for the poster.

The GBIF client limits itself to 6 concurrent GBIF requests, retries `429` responses up to 3 times, honors `Retry-After` when present, and caches occurrence facet responses for 30 minutes. Species and dataset metadata are cached in memory for the session.

## Main Summary Query

The first place-level query asks for:

```text
facet=month
facet=year
facet=datasetKey
facet=kingdomKey
facet=basisOfRecord
facetLimit=300
```

It powers:

- total GBIF records: response `count`;
- monthly bars: `facet=month`, placed into a 12-item Jan-Dec array;
- record history: `facet=year`, sorted ascending;
- kingdom breakdown: top 5 `kingdomKey` counts, resolved through `/species/{key}` for labels;
- top datasets: top 3 `datasetKey` counts, resolved through `/dataset/{uuid}`;
- evidence mix: `basisOfRecord` counts divided by total records.

If month or kingdom data is missing, the app uses small built-in fallback data so the poster still renders. Live GBIF data is preferred whenever available.

## Poster Cards

The poster uses a fixed 6 x 4 grid, 24 cells total. Cards are generated in registry order and skipped if there is no eligible data or no remaining area.

### Title

Shows the selected place name, subtitle, and a small globe marker at the selected latitude/longitude. The title card is locked by default at the top-left of the poster.

### Sightings And Comparison

Shows the total GBIF occurrence count for the selected area. It also shows the top 3 kingdoms by share:

```text
kingdomShare = kingdomCount / sum(topKingdomCountsShown)
```

The same card includes IUCN record buckets when available:

- "Doing well": `LC`
- "Watch list": `NT + DD`
- "At risk": `VU + EN + CR`

Counts here are species-facet counts by IUCN category from the conservation query, not local population estimates.

The comparison bars come from `comparison_precompute.json`, not from live browser computation. The selected place is matched to the nearest precomputed city within 75 km; if no city matches, the app uses the first precomputed country row whose bounding box contains the point. The card currently displays:

- recording intensity percentile: records per square kilometer;
- threatened-share percentile: threatened IUCN record share.

`uniqueSpecies` exists in the precomputed file but is intentionally not displayed in the current card because an earlier precompute version saturated this metric for many places.

### Hero Species

The hero is the first item in `topSpeciesData`. Top species are built from taxonomic slot rules. Each slot asks GBIF for `facet=speciesKey` with a taxon filter and `facetLimit=3` unless overridden.

Hero and mini slot rules:

- Mammal: `classKey=359`, fallback `classKey=358`, fallback `classKey=131`
- Bird: `classKey=212`
- Insect: `classKey=216`
- Flowering plant: `classKey=220`
- Tree or fern: `classKey=194`, fallback `classKey=7228684`, fallback `classKey=196`
- Fungus: `kingdomKey=5`

The app sorts each pool by count descending, then taxon key ascending. It keeps candidates whose count is at least 10% of the top candidate, while always keeping at least the first 2 candidates when available. A seeded shuffle chooses one unseen species per slot.

### Mini Species

Mini species cards use the remaining `topSpeciesData` entries after the hero. The fixed layout renders up to 7 mini cards. Two extra mini slots are selected from underrepresented groups when available:

- Reptile: `classKey=358`
- Amphibian: `classKey=131`
- Fish: `classKey=204`
- Arachnid: `classKey=367`

If the local data is too sparse, built-in fallback species can backfill the mini gallery so the grid remains complete.

### Thematic Species

The poster can show two primary thematic 1 x 1 species cards, plus hidden backup candidates used to fill gaps after locks. Three themes are built:

- In season: top `speciesKey` records for the current calendar month, `facetLimit=5`, keep up to 3.
- Small wonder: merges insect `classKey=216` and fungus `kingdomKey=5`, `facetLimit=5` per source, keep up to 3 unique species.
- Night creature: merges bats `orderKey=734`, owls `orderKey=1450`, nightjars `familyKey=5225`, frogmouths `familyKey=9337`, potoos `familyKey=9324`, oilbird `familyKey=9346`, moth families `7015`, `6950`, `4532185`, `8841`, hawk moths `familyKey=8868`, and fireflies `familyKey=4737`.

Within each theme, species are sorted by count and deduplicated. A seeded shuffle rotates viable candidates. The three theme cards are also seeded-shuffled; after deduplication, the first two surviving themes are rendered.

### Seasonality And Evidence Mix

The month chart uses the 12 monthly occurrence counts. Bar height is:

```text
monthHeight = monthCount / max(monthCounts)
```

Every nonzero display bar has a small minimum visible height so quiet months do not disappear visually.

The footer shows:

- first recorded year: earliest year facet value greater than 0;
- peak year: year facet row with the highest count;
- last-decade percentage: records from years greater than or equal to `currentYear - 9`, divided by all year-facet records.

The evidence mix uses `basisOfRecord` counts. Share is:

```text
recordTypeShare = basisOfRecordCount / totalRecords
```

The poster shows the top 2 record types and an "other" bucket when the remaining share is above 0.5%.

User-facing evidence labels map GBIF basis values to plain language:

- `HUMAN_OBSERVATION`: citizen-science sightings
- `OBSERVATION`: field observations
- `MACHINE_OBSERVATION`: cameras and sensors
- `PRESERVED_SPECIMEN`: museum and herbarium specimens
- `MATERIAL_SAMPLE`: field samples
- `MATERIAL_CITATION`: published research records
- `LIVING_SPECIMEN`: living collections
- `FOSSIL_SPECIMEN`: fossils
- `OCCURRENCE`: other records

### At-Risk Species

The conservation hook first counts species by IUCN category for:

```text
LC, NT, VU, EN, CR, DD
```

For each category, it requests:

```text
GET /occurrence/search
  ?limit=0
  &facet=speciesKey
  &facetLimit=40000
  &iucnRedListCategory={category}
```

The category card totals are the number of distinct species keys returned by each category facet. If the count reaches 40,000, it is marked capped.

Threatened species cards use a severity cascade:

1. Try `CR`.
2. If no `CR` species exist, try `EN`.
3. If no `EN` species exist, try `VU`.

The app requests the top 5 species for the winning category. After resolving species metadata, candidates are grouped by class for animals or kingdom for non-animals. From each group, the app keeps the top 3 by local record count and uses the poster seed to pick one. The rendered at-risk card then seeded-shuffles this pool and shows up to 2 species.

### Signature Species

The signature species card asks: which common-ish global species is observed disproportionately often in this place?

Live signature computation uses:

```text
GET /occurrence/search
  ?limit=0
  &facet=speciesKey
  &facetLimit=500
```

It compares local species shares against `global_baseline.json`, which stores the global total record count and the top 500 global species counts.

Eligibility:

- selected place must have at least 2,000 local GBIF records;
- species must have at least 20 local records;
- species must exist in the top-500 global baseline;
- over-representation ratio must be at least 1.5.

Formula:

```text
localShare = localSpeciesCount / localTotalRecords
globalShare = globalSpeciesCount / globalTotalRecords
overRepresentationRatio = localShare / globalShare
```

The hook sorts by ratio descending, resolves metadata for the top 15, chooses a class-diverse pool of up to 3, and the card seeded-shuffles that pool to render one species. This is not an endemism claim. It is a "more represented here than globally in GBIF records" signal.

### Sources And QR

The sources card shows Bee Around branding, GBIF branding, and a QR code for the current share URL. It is locked by default at the bottom-right, but its content stays live so the QR code always matches the current poster state.

Top dataset metadata is fetched for the 3 largest `datasetKey` facet values:

```text
GET /dataset/{uuid}
```

Metadata includes title, publisher, DOI, and license when GBIF provides them.

## Species Names And Images

Species metadata comes from:

```text
GET /species/{key}
```

The selected language is sent as `Accept-Language`. Card naming preference is:

```text
vernacularName -> canonicalName -> scientificName
```

Scientific names remain visible because common names may be missing, duplicated, translated differently, or region-specific.

Images are best-effort. For every species without an existing image, the app tries active image sources in priority order:

1. iNaturalist: `/v1/taxa?per_page=10&rank=species&q={canonicalName}`. The result must exactly match the scientific name to avoid fuzzy mismatches. Uses `default_photo.medium_url` and `square_url` where available.
2. Wikidata/Wikimedia: SPARQL query for `P846` equal to the GBIF taxon key, then Wikidata entity `P18`, then Commons image metadata and thumbnails.
3. GBIF: `/species/{key}/media?limit=1`, using the first item with `identifier` or `references`.

Image fetches time out after 8 seconds per source. Successful image results are cached for the session. Null results are not permanently cached, so background retries can recover from transient rate limits or network failures. The UI does not filter species by image availability because doing so would make identical share links choose different species depending on image-fetch luck.

## Deduplication Rules

Species candidates are built independently, then a single deduplication pass avoids repeated species across cards. Earlier slots win:

1. Top species gallery: hero plus mini cards claim all their species.
2. At-risk pool: removes species already claimed, then claims survivors.
3. Thematic cards: removes claimed species; first 2 surviving themes claim their first species. Up to 2 more themes are kept as backup.
4. Signature species: removes species claimed above.

This is why a highly recorded species may be present in a lower-priority pool but not appear: it may already be visible elsewhere.

## Regenerate, Seeds, And Locks

`posterSeed` starts at 1 and increments when the user clicks Regenerate. Seeded choices use an FNV-1a hash and a mulberry32 pseudo-random generator. Given the same place, seed, language, and source data, the same poster choices should be reproduced.

Regenerate can change:

- selected species within candidate pools;
- which thematic cards appear;
- the signature species pick;
- grid placement;
- any unlocked cards.

It does not change the selected place or the underlying GBIF query area.

Most cards can be locked. A lock stores:

- `slotId`
- grid `x` and `y`
- the `captureSeed` active when the card was locked

Locked cards keep their content and position across Regenerate. The title and sources cards are locked by default. Unlocking a card keeps the visible card stable until the next Regenerate so the click itself does not reshuffle the poster.

## Share URLs

The app keeps the URL synchronized with poster state.

The `s=` parameter stores place and seed:

- known fallback place: `k.<seed36>.<index36>`
- searched/custom place: `c.<seed36>.<lat>.<lon>.<r10>.<bbox|_>.<nameB64>[.<cc>]`

Coordinates and bbox values are quantized to 1e-4 degrees. Radius is stored in tenths of a kilometer. Custom places are canonicalized so the original tab and reopened tab use the same geometry and therefore the same seeded selection keys.

The `l=` parameter stores user-managed locks:

```text
<slotId>_<x36>_<y36>_<captureSeed36>,...
```

Absent `l=` means default locks are applied. Empty `l=` means the user explicitly cleared all locks.

The URL also stores `lang=` and `theme=`.

## Precomputed Comparison Data

Bee Around ships with:

- `comparison_precompute.json`: 477 rows, generated on 2026-05-12, with 195 countries and 282 cities.
- `global_baseline.json`: global total record count, monthly counts, and top 500 global species counts.

The comparison precompute notebook:

1. Resolves curated countries and cities through Nominatim and stores their bounding boxes.
2. Uses GBIF occurrence facets for each bounding box.
3. Computes approximate bbox area on a sphere using Earth radius 6371.0088 km:

```text
area = abs(sin(latMax) - sin(latMin)) * abs(lonDeltaRadians) * earthRadiusKm^2
```

4. Computes:

```text
recordsPerKm2 = totalRecords / areaKm2
threatenedShare = (VU + EN + CR record counts) / all returned IUCN record counts
uniqueSpecies = paginated count of speciesKey facet rows
```

5. Converts each metric into a percentile within its own cohort, where cities compare to cities and countries compare to countries:

```text
percentile = numberOfCohortValuesLessThanOrEqualToThisValue / cohortSize
```

6. Computes precomputed signature species with the same share-ratio idea used at runtime:

```text
localShare / globalShare
```

The runtime comparison card uses only the row lookup and percentiles. Runtime live signature species uses `global_baseline.json` directly so it can work for any searched place, not only curated precompute rows.

## Export And Print

The PDF button opens the browser print dialog. From there, choose Save as PDF or print normally. The poster is sized as a fixed grid, so exported versions keep the same card arrangement. Species photos are raster images; text, icons, QR code, and most layout graphics remain browser-rendered.
