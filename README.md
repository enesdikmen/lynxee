# Bee Around

Bee Around turns open biodiversity records into playful, shareable portraits of places. Pick a city or country-scale place and the app builds a bento poster showing what GBIF records reveal there: species, seasonality, record types, conservation signals, comparison context, data sources, photo credits, and a QR-backed share link.

It is designed for people who want a friendly first step into biodiversity data: educators, students, outreach teams, GBIF nodes, local communities, challenge judges, and curious readers who may not normally open a data portal first.

Bee Around is honest about scope: it visualizes available GBIF-mediated records for the selected area. It is not a complete census of all life in that place.

## What It Does

- Searches places with OpenStreetMap Nominatim, then asks GBIF for compact occurrence summaries for that area.
- Builds a fixed 6 x 4 poster with a title card, total-record card, hero species, mini species cards, thematic species, seasonality and evidence mix, at-risk species, signature species, and sources/QR card.
- Uses public GBIF endpoints directly from the browser: `/v1/occurrence/search`, `/v1/species/{key}`, `/v1/species/{key}/media`, and `/v1/dataset/{uuid}`.
- Uses image sources in this order: iNaturalist, Wikidata/Wikimedia Commons, then GBIF species media. Image credits and source links are shown when metadata is available.
- Lets each Regenerate produce a new deterministic version of the same place using a poster seed. Shared URLs reopen the same place, seed, theme, language, and user-managed card locks.
- Lets users lock favorite cards, switch visual themes, switch interface/name language, and export with the browser print/PDF flow.

## How The Poster Is Calculated

Most numbers come from GBIF occurrence facet queries with `limit=0`. That means Bee Around asks GBIF for counts and grouped summaries, not full occurrence downloads.

For a place, the main summary query requests:

```text
GET https://api.gbif.org/v1/occurrence/search
  ?limit=0
  &decimalLatitude=min,max
  &decimalLongitude=min,max
  &facet=month
  &facet=year
  &facet=datasetKey
  &facet=kingdomKey
  &facet=basisOfRecord
  &facetLimit=300
```

Country-scale bounding boxes, defined as at least 20 degrees of latitude or 40 degrees of longitude, use `country=XX` instead of latitude/longitude ranges when an ISO-2 country code is available.

The poster also makes smaller facet queries for species-selection pools, IUCN buckets, threatened species, thematic species, and signature species. Details are in [How Bee Around works](docs/how-it-works.md) and [Data and attribution](docs/data-and-attribution.md).

## GBIF Challenge Fit

Bee Around was built as a public-facing entry concept for the GBIF Ebbe Nielsen Challenge. The aim is to make GBIF-mediated biodiversity data legible, reusable, and shareable: a compact visual story of a place, with links and credits that point back to the underlying biodiversity network.

The project emphasizes:

- approachability: poster cards instead of a data portal first;
- transparency: visible caveats, source links, licenses, and GBIF taxon links;
- repeatable exploration: seeded regeneration and share URLs;
- public value: education, outreach, local biodiversity conversation, and quick demonstrations of open data.

## Learn More

- [How Bee Around works](docs/how-it-works.md)
- [Data and attribution](docs/data-and-attribution.md)
- [Precompute notebook](docs/precompute_comparison_sample.ipynb)

## Run Locally

From this folder:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

To build a production version:

```bash
npm run build
```

## Implementation Notes

Bee Around is a frontend-only React/Vite app. It calls public web APIs directly from the browser. It includes two static precomputed data files: `comparison_precompute.json` for peer percentiles and curated comparison rows, and `global_baseline.json` for global signature-species ratios. The precompute workflow used to create those files is documented in `docs/precompute_comparison_sample.ipynb`.
