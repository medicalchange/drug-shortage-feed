# Canada Drug Shortage Feed Service

This service pulls shortage reports from `healthproductshortages.ca/api/v1` and serves a stable, condensed feed for your public website.

Current production model:
- Overnight: refresh seed snapshot from Health Canada API.
- Daytime: serve condensed results from seed snapshot (fast + stable).
- Public page displays one line per drug with dose(s) and expected back-in-stock date.

## Data Source

- `POST /api/v1/login` -> returns `auth-token` header.
- `GET /api/v1/search` -> paginated shortage/discontinuation report data.

Reference docs page:
- `https://healthproductshortages.ca/blog/61`

## Environment Variables

Required:
- `HPS_EMAIL`
- `HPS_PASSWORD`

Optional:
- `HPS_API_BASE_URL` (default: `https://healthproductshortages.ca/api/v1`)
- `HPS_PAGE_SIZE` (default: `100`)
- `HPS_MAX_RECORDS` (default: `2000`)
- `HPS_TERM`
- `HPS_DIN`
- `HPS_REPORT_ID`
- `HPS_FILTER_STATUS`

## API Endpoints

- `GET /healthz`
  - Service health.

- `POST /api/shortages/sync`
  - On-demand full sync from Health Canada API to runtime cache.
  - Primarily for operational/admin use.

- `GET /api/shortages`
  - Full normalized records from runtime cache.

- `GET /api/shortages/new`
  - New/updated records since previous sync run.

- `GET /api/shortages/condensed`
  - Seed-snapshot based, grouped one-line-ready output.
  - Includes metadata:
    - `refreshedAt` (seed refresh timestamp)
    - `source` (`seed-cache`)
  - Intended for public website consumption.

### Common query params

- `status=active`
- `type=shortage`
- `resolved=false`
- `require_eta=true`
- `limit=...`

## Seed Snapshot Files

- `data/seed-cache.json` -> fallback/stable source for condensed daytime feed.
- `data/seed-meta.json` -> metadata (`refreshedAt`, `count`).

Runtime-only files:
- `data/shortages-cache.json`
- `data/state.json`

## Nightly Refresh Workflow

GitHub Actions workflow:
- `.github/workflows/sync-shortages.yml`

It runs nightly at `08:00 UTC` and updates:
- `data/seed-cache.json`
- `data/seed-meta.json`

It commits and pushes changes automatically when data changed.

### Required GitHub Secrets

In repo `medicalchange/drug-shortage-feed` add:
- `HPS_EMAIL`
- `HPS_PASSWORD`

## Local Run

Create `.env`:

```bash
cp .env.example .env
```

Start server:

```bash
npm start
```

## Med-info Integration

Public page uses condensed endpoint and shows refresh timestamp:
- `https://medicalchange.github.io/med-info/shortages/`

Example request used by page:

```text
GET /api/shortages/condensed?status=active&type=shortage&resolved=false&require_eta=true&limit=1000
```
