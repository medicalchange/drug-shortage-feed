import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CACHE_FILE = path.join(DATA_DIR, 'shortages-cache.json');

const defaultState = {
  lastSyncAt: null,
  seenIds: [],
  lastNewIds: []
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export async function loadState() {
  return readJson(STATE_FILE, defaultState);
}

export async function saveState(state) {
  await writeJson(STATE_FILE, state);
}

export async function loadCache() {
  return readJson(CACHE_FILE, []);
}

export async function saveCache(records) {
  await writeJson(CACHE_FILE, records);
}

export function buildNewRecords(records, state) {
  const seen = new Set(state.seenIds || []);
  return records.filter((record) => !seen.has(record.id));
}
