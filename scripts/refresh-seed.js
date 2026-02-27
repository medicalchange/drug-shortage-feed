import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../src/env.js';
import { fetchAllShortages } from '../src/fdaShortages.js';
import { toCondensedRows } from '../src/condense.js';

loadEnv();

const DATA_DIR = path.resolve('data');
const SEED_FILE = path.join(DATA_DIR, 'seed-cache.json');
const META_FILE = path.join(DATA_DIR, 'seed-meta.json');
const HISTORY_LIMIT = 14;

function toIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildSeed(records) {
  return records
    .filter((r) => String(r.type || '').toLowerCase() === 'shortage')
    .filter((r) => String(r.status || '').toLowerCase().includes('active'))
    .filter((r) => r.resolved !== true)
    .filter((r) => Boolean(r.expectedBackInStockDate))
    .map((r) => ({
      id: r.id,
      reportId: r.reportId,
      type: r.type,
      brandName: r.brandName,
      status: r.status,
      din: r.din,
      strength: r.strength,
      expectedBackInStockDate: toIso(r.expectedBackInStockDate),
      resolved: r.resolved,
      updatedDate: r.updatedDate,
      updateDate: r.updateDate,
      postedDate: r.postedDate
    }))
    .filter((r) => Boolean(r.expectedBackInStockDate));
}

async function writeJson(filePath, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function buildHistory(previousMeta, nextEntry) {
  const existing = Array.isArray(previousMeta?.addedHistory) ? previousMeta.addedHistory : [];
  return [nextEntry, ...existing].slice(0, HISTORY_LIMIT);
}

async function main() {
  const [previousSeed, previousMeta] = await Promise.all([
    readJson(SEED_FILE, []),
    readJson(META_FILE, {})
  ]);

  const all = await fetchAllShortages();
  const seed = buildSeed(all);
  const previousCondensed = toCondensedRows(Array.isArray(previousSeed) ? previousSeed : []);
  const currentCondensed = toCondensedRows(seed);
  const previousNames = new Set(previousCondensed.map((row) => row.drug.toLowerCase()));
  const addedDrugs = currentCondensed.filter((row) => !previousNames.has(row.drug.toLowerCase()));

  const refreshedAt = new Date().toISOString();
  const historyEntry = {
    refreshedAt,
    addedDrugsCount: addedDrugs.length,
    addedDrugs
  };

  const meta = {
    refreshedAt,
    count: seed.length,
    addedDrugsCount: addedDrugs.length,
    addedDrugs,
    addedHistory: buildHistory(previousMeta, historyEntry)
  };

  await writeJson(SEED_FILE, seed);
  await writeJson(META_FILE, meta);

  console.log(JSON.stringify({
    refreshedAt: meta.refreshedAt,
    count: meta.count,
    addedDrugsCount: meta.addedDrugsCount,
    historyCount: meta.addedHistory.length
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
