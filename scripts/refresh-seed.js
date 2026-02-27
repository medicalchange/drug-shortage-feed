import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../src/env.js';
import { fetchAllShortages } from '../src/fdaShortages.js';

loadEnv();

const DATA_DIR = path.resolve('data');
const SEED_FILE = path.join(DATA_DIR, 'seed-cache.json');
const META_FILE = path.join(DATA_DIR, 'seed-meta.json');

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

async function main() {
  const all = await fetchAllShortages();
  const seed = buildSeed(all);
  const meta = {
    refreshedAt: new Date().toISOString(),
    count: seed.length
  };

  await writeJson(SEED_FILE, seed);
  await writeJson(META_FILE, meta);

  console.log(JSON.stringify(meta));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
