# Canada Drug Shortage Feed Service

This service pulls shortage reports from `healthproductshortages.ca/api/v1` and publishes a stable, condensed nightly snapshot for your public website.

Current production model:
- Overnight: refresh snapshot from Health Canada API via GitHub Actions.
- Daytime: public site reads static JSON from this repo (no backend runtime required).
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

## Nightly Static Files

Generated and committed by workflow:
- `data/seed-cache.json` -> filtered active shortage seed data.
- `data/seed-meta.json` -> metadata (`refreshedAt`, `count`, additions).
- `data/condensed-shortages.json` -> one-line-ready public payload used by website.

`data/condensed-shortages.json` contains:
- `count`
- `refreshedAt`
- `source`
- `addedDrugsCount`
- `addedDrugs`
- `addedHistory` (last 14 refreshes)
- `results`

## Nightly Refresh Workflow

GitHub Actions workflow:
- `.github/workflows/sync-shortages.yml`

Runs nightly at `08:00 UTC` and commits updated files when changed.

### Required GitHub Secrets

In repo `medicalchange/drug-shortage-feed` add:
- `HPS_EMAIL`
- `HPS_PASSWORD`

## Optional Runtime API

A Node server still exists (`src/server.js`) for optional runtime/admin use, but public website reads static snapshot JSON by default.

## Local Run

Create `.env`:

```bash
cp .env.example .env
```

Start server (optional):

```bash
npm start
```

## Med-info Integration

Public site can read this static URL directly:
- `https://cdn.jsdelivr.net/gh/medicalchange/drug-shortage-feed@main/data/condensed-shortages.json`
