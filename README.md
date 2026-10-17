# Paper City

**Follow the homes, not the headlines.** A browser-based field guide to Toronto housing, built for Hack the Valley 11.

An interactive 3D map uses real City coordinates and recorded housing counts. A four-chapter journey moves from planning to approvals, construction, and occupied projects. Visitors can search addresses, filter wards and housing categories, open project evidence, interpret a housing statement, and download a shareable field note.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

Import this directory as a Next.js project in Vercel. The default build command is `npm run build`. No database, persistent server, cron job, or map API key is needed.

The paper map, claim guide, and screenshot OCR work without accounts or API keys. Screenshot recognition uses a locally served Tesseract WASM engine and English model. Images and claim text remain in the visitor’s browser.

### Optional photorealistic Google 3D

The app automatically uses Google 3D when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured. Visitors can switch between the real city and the paper map. Interactive markers preserve the same City records, filters, and journey chapters. The Orbit control circles the current viewpoint; chapter controls fly between Toronto projects.

For a hackathon prototype, a [Google Maps Demo Key](https://developers.google.com/maps/demo-key) supports 3D without billing information. Usage stops at the demo quota without charges. The demo key is for prototypes, not a production-service entitlement. This project does not enable billing or upgrade the account.

Add the browser key to `.env.local` for local use, or to Vercel’s environment variables **before building**:

```text
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-demo-key
```

Google browser map keys are intentionally present in the browser bundle. The local config is ignored by Git. If deploying a standard paid-project key later, configure appropriate application and API restrictions in Google Cloud first. No key is required for the fallback map.

Optionally set `NEXT_PUBLIC_SITE_URL` to the final public origin for social metadata.

## Data

- [Official Affordable Housing Pipeline](https://open.toronto.ca/dataset/upcoming-and-recently-completed-affordable-housing-units/)
- City CKAN resource: `1cef72d8-4bc0-4705-a4ba-998bcb4605ef`
- Bundled snapshot: **277 projects**, source refreshed **September 30, 2026**. Exact retrieval and refresh timestamps are stored in `data/housing.json`.
- [City’s housing definitions and targets](https://www.toronto.ca/city-government/data-research-maps/toronto-housing-data-hub/housing-data/)

Refresh before a later deployment:

```sh
npm run data:refresh
npm test
npm run build
```

The refresh script checks unique IDs, coordinates, and nonnegative counts and only writes a complete successful download. It fetches metadata first, discovers the active City resource, and paginates all records.

### Interpretation

- Affordable, rent-controlled market, RGI, and supportive counts are **separate**. They can overlap and are never added together.
- Unit fields are recorded approved-unit counts, grouped by project status. A project’s “Occupied” status is not an audit of each home’s occupancy or availability.
- Approved and permit statuses are distinct from actual construction starts.
- 3D stacks are data symbols with square-root height scaling at reported coordinates. They do not represent real building footprints or heights.
- This is one housing-program dataset, not all housing or available rentals in Toronto. A quarterly snapshot does not establish milestone dates, reasons for delay, or the truth of a citywide delivery claim.
- Map tiles and geospatial styling are provided by CARTO and OpenStreetMap, with attribution displayed on the map.

## Check

```sh
npm test
npm run typecheck
npm run build
```

The focused tests check snapshot validity, non-overlapping stage sums, permit/construction distinctions, combined filters, category isolation, explicit claim interpretation, and exported briefing scope.

## Demo in four minutes

1. Start “Take the journey”. Fly through all four chapters, rotate the map, and watch the housing counts change with the reported stage.
2. Exit to the explorer. Pick a ward, housing category, or project. Open its official evidence.
3. Select “Read a claim”. Use the City’s 65,000-home target as an example, confirm the extracted fields, and inspect the source guide’s target/delivery and rent-control/affordability distinctions.
4. Save a field note. Share its URL to preserve the current filters and selected project.

Primary challenge: School of Cities. Claim reading uses Google Gemini through a server route when `GEMINI_API_KEY` is set, and falls back to the offline rule-based guide and on-device OCR otherwise. No candidate rankings, endorsements, or election predictions.

## OCR assets

The English model in `public/ocr/eng.traineddata.gz` is the official compact LSTM English model from `@tesseract.js-data/eng/4.0.0_best_int`, served by jsDelivr. Tesseract and its trained data are Apache 2.0 licensed. Worker and WASM assets are copied from installed packages during `predev` and `prebuild`, not downloaded at runtime from a third party. The core and model download only when a visitor chooses screenshot reading.

## Design

TasteSkill’s existing-project redesign guidance was applied to typography, contrast, control sizing, visual hierarchy, and the map-first journey. Maps are the product imagery; generic stock photos and fake proof were not added.
# Design and source checks

Run the offline FixMySlop rules against the application sources:

```sh
uvx fixmyslop scan app components lib scripts tests --no-static --fail-on medium
```

This checks authored application code, excluding generated map/OCR assets and the City data snapshot. The before/after reports are in `artifacts/fixmyslop-before.json` and `artifacts/fixmyslop-after.json`. Review the desktop and mobile layouts alongside the findings. A clean static scan does not assess map accuracy or visual quality.

