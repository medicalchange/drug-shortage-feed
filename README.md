# Canada Drug Shortage Feed Service

This service pulls shortage/discontinuation reports from `healthproductshortages.ca/api/v1`, tracks what is new or newly updated between syncs, and exposes endpoints your med-info website can render.

## Source review

The page you shared (`/blog/61`) documents the authenticated API:

- `POST /api/v1/login` returns `auth-token` in response headers.
- `GET /api/v1/search` returns paginated report data (`total`, `limit`, `offset`, `data`).

## Required environment variables

- `HPS_EMAIL` - your API account email
- `HPS_PASSWORD` - your API account password

Optional filters:

- `HPS_TERM`
- `HPS_DIN`
- `HPS_REPORT_ID`
- `HPS_FILTER_STATUS`
- `HPS_API_BASE_URL` (default: `https://healthproductshortages.ca/api/v1`)
- `HPS_PAGE_SIZE` (default: `100`)
- `HPS_MAX_RECORDS` (default: `5000`)

## Endpoints

- `POST /api/shortages/sync`
  - Authenticates, fetches latest paged search results, updates cache/state.
  - Returns `newRecords` for this sync run.
- `GET /api/shortages`
  - Returns cached records.
- `GET /api/shortages/new`
  - Returns records flagged as new/updated in the most recent sync.
- `GET /healthz`
  - Health check.

## Run

Create a local `.env` file (recommended) from `.env.example` and set credentials:

```bash
cp .env.example .env
```

Then run:

```bash
npm start
```

Then open: `http://localhost:8080`

## Add to your med-info website

```html
<div id="drug-shortage-widget"></div>
<script src="https://YOUR-SHORTAGE-SERVICE/shortage-widget.js"></script>
<script>
  window.DrugShortageWidget.init({
    apiBaseUrl: 'https://YOUR-SHORTAGE-SERVICE',
    mountSelector: '#drug-shortage-widget',
    mode: 'new',
    statusFilter: 'active',
    typeFilter: 'shortage',
    resolvedFilter: 'false',
    requireEta: false,
    limit: 20,
    title: 'Active Canada Drug Shortages'
  });
</script>
```

API filters:

- `status=active`
- `type=shortage`
- `resolved=false`
- `require_eta=true` (only records with expected back-in-stock date)

## Scheduling

Run sync every 6 hours:

```bash
0 */6 * * * curl -X POST https://YOUR-SHORTAGE-SERVICE/api/shortages/sync
```

## Notes

- Data is stored in `data/state.json` and `data/shortages-cache.json`.
- `mode: 'new'` shows the latest newly detected/updated reports from the most recent sync.
