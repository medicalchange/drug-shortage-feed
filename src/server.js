import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { loadEnv } from './env.js';
import { fetchAllShortages } from './fdaShortages.js';
import {
  buildNewRecords,
  loadCache,
  loadState,
  saveCache,
  saveState
} from './store.js';

loadEnv();
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = path.resolve('public');

let isSyncInProgress = false;

async function ensureCacheWarm() {
  const cached = await loadCache();
  if (cached.length > 0) return cached;

  await syncShortages();
  return loadCache();
}

function isActiveStatus(value) {
  return String(value || '').toLowerCase().includes('active');
}

function filterRecords(records, query) {
  let out = records;

  const statusFilter = (query.get('status') || '').trim().toLowerCase();
  if (statusFilter) {
    out = statusFilter === 'active'
      ? out.filter((item) => isActiveStatus(item.status))
      : out.filter((item) => String(item.status || '').toLowerCase() === statusFilter);
  }

  const typeFilter = (query.get('type') || '').trim().toLowerCase();
  if (typeFilter) {
    out = out.filter((item) => String(item.type || '').toLowerCase() === typeFilter);
  }

  const resolvedFilter = (query.get('resolved') || '').trim().toLowerCase();
  if (resolvedFilter === 'false') {
    out = out.filter((item) => item.resolved !== true);
  } else if (resolvedFilter === 'true') {
    out = out.filter((item) => item.resolved === true);
  }

  const requireEta = (query.get('require_eta') || '').trim().toLowerCase();
  if (requireEta === 'true') {
    out = out.filter((item) => Boolean(item.expectedBackInStockDate));
  }

  return out;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

function sendFile(res, status, contentType, content) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(content);
}

async function serveStatic(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const absolute = path.join(PUBLIC_DIR, safePath);

  if (!absolute.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  try {
    const content = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const mime =
      ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.js'
          ? 'application/javascript; charset=utf-8'
          : ext === '.css'
            ? 'text/css; charset=utf-8'
            : 'application/octet-stream';
    sendFile(res, 200, mime, content);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

async function syncShortages() {
  if (isSyncInProgress) {
    return { skipped: true, reason: 'sync already in progress' };
  }

  isSyncInProgress = true;
  try {
    const [state, previousCache] = await Promise.all([loadState(), loadCache()]);
    const latest = await fetchAllShortages();

    const newById = new Map(buildNewRecords(latest, state).map((item) => [item.id, item]));
    const previousById = new Map(previousCache.map((item) => [item.id, item]));

    for (const item of latest) {
      const prior = previousById.get(item.id);
      if (!prior) continue;
      const priorDate = new Date(prior.updateDate || prior.createdAt || 0).getTime();
      const nextDate = new Date(item.updateDate || item.createdAt || 0).getTime();
      if (nextDate > priorDate) {
        newById.set(item.id, item);
      }
    }

    const nextState = {
      lastSyncAt: new Date().toISOString(),
      seenIds: latest.map((item) => item.id),
      lastNewIds: [...newById.keys()]
    };

    await Promise.all([saveCache(latest), saveState(nextState)]);

    return {
      skipped: false,
      syncedAt: nextState.lastSyncAt,
      totalShortages: latest.length,
      newCount: newById.size,
      newRecords: [...newById.values()].slice(0, 100)
    };
  } finally {
    isSyncInProgress = false;
  }
}

async function handler(req, res) {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === 'GET' && pathname === '/healthz') {
      sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/shortages/sync') {
      const result = await syncShortages();
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/shortages') {
      const cached = await ensureCacheWarm();
      const limit = Number(url.searchParams.get('limit') || 100);
      const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
      const filtered = filterRecords(cached, url.searchParams);
      sendJson(res, 200, { count: filtered.length, results: filtered.slice(0, safeLimit) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/shortages/new') {
      const cache = await ensureCacheWarm();
      const state = await loadState();
      const newSet = new Set(state.lastNewIds || []);
      const limit = Number(url.searchParams.get('limit') || 100);
      const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
      const onlyNew = cache.filter((item) => newSet.has(item.id));
      const filtered = filterRecords(onlyNew, url.searchParams).slice(0, safeLimit);
      sendJson(res, 200, { lastSyncAt: state.lastSyncAt, count: filtered.length, results: filtered });
      return;
    }

    if (req.method === 'GET') {
      await serveStatic(res, pathname);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'internal error' });
  }
}

const runOnce = process.argv.includes('--sync-once');

if (runOnce) {
  syncShortages()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`Drug shortage service running on http://localhost:${PORT}`);
  });
}
