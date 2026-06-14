# Data And Attribution

Bee Around is powered mainly by GBIF-mediated biodiversity data, with place search from OpenStreetMap Nominatim and optional species images from iNaturalist, Wikidata/Wikimedia Commons, and GBIF species media.

The poster shows patterns in available records. It should not be read as a complete inventory of nature, proof of current presence, or a local conservation assessment.

## Data Sources Used In The App

### GBIF Occurrence Search

Most numbers come from:

```text
https://api.gbif.org/v1/occurrence/search
```

Bee Around uses `limit=0` with facets so GBIF returns counts rather than full record pages. The app uses these facet fields:

- `month`: monthly observation pattern;
- `year`: first year, peak year, recent-record share;
- `datasetKey`: top contributing datasets;
- `kingdomKey`: top broad taxonomic groups;
- `basisOfRecord`: how the records were made;
- `speciesKey`: species-selection pools, threatened species, signature species;
- `iucnRedListCategory`: conservation buckets.

The app also sends filters such as `classKey`, `kingdomKey`, `orderKey`, `familyKey`, `speciesKey`, `mediaType`, `month`, `year`, and `iucnRedListCategory` when a card needs a smaller pool.

### GBIF Species Metadata

Species names and taxonomy come from:

```text
https://api.gbif.org/v1/species/{key}
```

The app requests this endpoint with the selected language as `Accept-Language`. It uses:

- `vernacularName` for common names when GBIF supplies one in the language context;
- `canonicalName` and `scientificName` as fallbacks;
- `kingdom`, `phylum`, and `class` for the visible taxon line.

Every species info panel links to:

```text
https://www.gbif.org/species/{key}
```

### GBIF Species Media

GBIF is the third image fallback source:

```text
https://api.gbif.org/v1/species/{key}/media?limit=1
```

Bee Around looks for the first media item with `identifier` or `references`. It uses creator or rights holder, license, and source URL when present.

### GBIF Dataset Metadata

Top dataset metadata comes from:

```text
https://api.gbif.org/v1/dataset/{uuid}
```

The source workflow is:

1. Get top dataset UUIDs from `facet=datasetKey`.
2. Keep the top 3 by occurrence count in the selected place.
3. Fetch dataset metadata.
4. Store visible summaries with title, occurrence count, DOI, publisher, and license when available.

The current poster mainly surfaces GBIF/source branding and QR/share context. The dataset metadata is available in the data layer for source-oriented cards and future detail views.

### OpenStreetMap Nominatim

Place search comes from:

```text
https://nominatim.openstreetmap.org/search
```

Nominatim provides the selected label, point, country code, and bounding box. Bee Around displays OpenStreetMap attribution in search results. The selected boundary box becomes the default GBIF area filter.

### iNaturalist Images

iNaturalist is the first image source:

```text
https://api.inaturalist.org/v1/taxa
  ?per_page=10
  &rank=species
  &q={scientificName}
```

Because iNaturalist search is fuzzy, Bee Around requires an exact scientific-name match before accepting the `default_photo`. It uses medium-size and square-size URLs instead of original-size assets.

### Wikidata And Wikimedia Commons Images

Wikidata/Wikimedia Commons is the second image source. The app:

1. Runs a Wikidata SPARQL query for `P846`, the GBIF taxon key property.
2. Reads the matching Wikidata entity.
3. Uses image claim `P18` when present.
4. Requests Commons image metadata and thumbnail URLs.

The app stores author, license name, license URL, and Commons source URL when returned.

## Place Geometry And Area Caveats

For city-like places, Bee Around usually uses Nominatim's administrative bounding box:

```text
decimalLatitude=minLat,maxLat
decimalLongitude=minLon,maxLon
```

For very large country-scale boxes, it uses:

```text
country=XX
```

This avoids asking GBIF for huge latitude/longitude rectangles when a country filter is clearer. The threshold is latitude span at least 20 degrees or longitude span at least 40 degrees.

If Nominatim has no usable bounding box, the app falls back to a rectangle around the selected point using `radiusKm`. This is an approximate square-ish search area, not a real city boundary.

The precomputed comparison file uses bounding-box area only for ranking context. It approximates area on a sphere:

```text
areaKm2 = abs(sin(latMax) - sin(latMin)) * abs(lonDeltaRadians) * 6371.0088^2
```

Because these are bounding boxes, area-normalized values are useful for rough comparison but should not be treated as exact jurisdictional densities.

## Exact Card Calculations

### Total Records

Displayed total:

```text
totalRecords = occurrenceSearch.count
```

This is the number of matching GBIF occurrence records for the selected area and filters.

### Kingdom Shares

The app asks for `facet=kingdomKey`, resolves the top 5 keys to labels with `/species/{key}`, and displays the top 3 shares:

```text
shownKingdomShare = kingdomCount / sum(top5KingdomCounts)
```

The denominator is the sum of the displayed top kingdom breakdown pool, not necessarily every kingdom in GBIF.

### Month Bars

The app converts month facet rows into a 12-value array. Missing months become 0.

```text
barRatio = monthCount / max(monthCounts)
```

### Year Summary

The app filters year facet rows to positive numeric years, sorts ascending, then calculates:

```text
firstYear = earliestYear
peakYear = yearWithHighestCount
peakYearCount = countAtPeakYear
recentPct = recordsFromYears >= currentYear - 9 / allYearFacetRecords
```

### Evidence Mix

Evidence mix uses `basisOfRecord`:

```text
share = basisOfRecordCount / totalRecords
```

It displays the top 2 basis values and groups the rest into "other" if the remainder is above 0.5%.

### IUCN Buckets

For each category `LC`, `NT`, `VU`, `EN`, `CR`, and `DD`, the app asks GBIF for `facet=speciesKey` with `iucnRedListCategory={category}`. The displayed category count is the number of distinct species facet rows returned, not the number of occurrence records.

The combined buckets are:

```text
doingWell = LC
watchList = NT + DD
atRisk = VU + EN + CR
```

Threatened percent is:

```text
threatenedPercent = round(((VU + EN + CR) / (LC + NT + VU + EN + CR + DD)) * 1000) / 10
```

This is based on species that appear in GBIF records with IUCN categories in the selected area. It is not a local Red List.

### At-Risk Species Cards

At-risk species use the highest-severity category that has records:

```text
CR first, else EN, else VU
```

For the winning category, the app requests the top 5 species by local occurrence count. It resolves metadata, groups animal candidates by class and non-animal candidates by kingdom, then seeded-picks among the top 3 per group. The card displays up to 2 seeded-shuffled candidates after global poster deduplication.

### Signature Species

The runtime signature species card compares local share to global share:

```text
localShare = localSpeciesCount / localTotalRecords
globalShare = globalSpeciesCount / globalTotalRecords
ratio = localShare / globalShare
```

Eligibility:

- local place has at least 2,000 records;
- species has at least 20 local records;
- species appears in `global_baseline.json`;
- ratio is at least 1.5.

The card text such as `12x` means "this species' share of local GBIF records is about 12 times its share of the global GBIF baseline used by the app."

### Peer Comparison Percentiles

Peer comparisons come from `comparison_precompute.json`. Rows are split into city and country cohorts. Percentile formula:

```text
percentile = count(valuesInSameCohort <= currentValue) / cohortSize
```

Displayed metrics:

- recording intensity: `totalRecords / bboxAreaKm2`;
- threatened share: `(VU + EN + CR record counts) / all returned IUCN record counts`.

The runtime app matches the selected point to a row by nearest city within 75 km, then country bbox containment.

## Precomputed Files

### `global_baseline.json`

Contains:

- `totalRecords`: global GBIF occurrence count at precompute time;
- `month`: global month counts;
- `topSpeciesGlobal`: top 500 global species counts.

It is used by runtime signature species. The current file has `totalRecords = 3,815,858,181` and 500 species rows.

### `comparison_precompute.json`

Contains 477 curated rows: 195 countries and 282 cities. It was generated on 2026-05-12.

For each row, the notebook:

1. Resolved the place through Nominatim.
2. Queried GBIF occurrence facets for the bounding box.
3. Counted total records.
4. Paginated `facet=speciesKey` to estimate unique species count without the old 1,000-row cap.
5. Computed IUCN counts and threatened share.
6. Computed bounding-box area and records per square kilometer.
7. Computed per-cohort percentiles.
8. Computed signature species against the global baseline.

The precompute is intentionally a comparison sample, not a full global gazetteer.

## Image Attribution

Species image attribution is best-effort and depends on source metadata.

Image source priority:

1. iNaturalist exact species-name match;
2. Wikidata/Wikimedia Commons GBIF-key match;
3. GBIF species media.

When available, Bee Around stores and displays:

- source label;
- author, creator, or rights holder;
- license;
- license URL;
- source page URL.

If no image is found, the card shows a placeholder but keeps the species identity and GBIF species link. Species selection never depends on whether an image loads, because that would make share links unstable under network or rate-limit differences.

## Data Attribution

The poster source card points to GBIF and includes a QR code back to the current Bee Around view. Species details link to GBIF species pages. Image details link to source pages where possible. Dataset metadata includes DOI, publisher, and license when GBIF supplies them.

For formal reuse, users should follow the licenses and citation guidance on:

- the GBIF occurrence dataset pages;
- the source media pages for photographs;
- OpenStreetMap/Nominatim attribution requirements for place search and boundary data;
- iNaturalist or Wikimedia Commons license terms for any images used from those sources.

A Bee Around poster is a convenient visual summary. It is not a replacement for GBIF download citations, dataset citations, or media-license review.

## Known Caveats

- Record volume reflects observation, digitization, and publishing activity, not only biodiversity.
- Popular places, charismatic species, active citizen-science communities, and well-digitized collections may appear strongly.
- Some records may have coordinate uncertainty, old dates, duplicate clusters, missing media, or changed taxonomy.
- Some species groups are easier to observe than others.
- Recent records may be incomplete because datasets are published and indexed over time.
- IUCN categories in GBIF records are useful signals, but they do not prove current local conservation status, population size, breeding status, or management priority.
- Bounding-box area is approximate and may include water, surrounding suburbs, or neighboring landscapes.
- Image availability, author metadata, and licensing vary heavily by source.

Bee Around is best read as an invitation: it helps people notice patterns, ask better questions, and follow links back to the open biodiversity data network.
