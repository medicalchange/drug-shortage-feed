function toDoseValues(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function normalizeDrugName(value) {
  let out = String(value || '').trim();
  if (!out) return 'Unnamed product';

  if (out.includes('-')) {
    out = out.replace(/^[^-]+-\s*/, '');
  }

  while (/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i.test(out)) {
    out = out.replace(/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i, '');
  }

  return out.trim() || 'Unnamed product';
}

export function isDisplayableDrugName(name) {
  const value = String(name || '').trim();
  if (!value) return false;
  if (/^\d/.test(value)) return false;
  return value.length > 3;
}

export function toCondensedRows(records) {
  const grouped = new Map();

  for (const item of records) {
    const drug = normalizeDrugName(item.brandName || 'Unnamed product');
    if (!isDisplayableDrugName(drug)) continue;
    const doses = toDoseValues(item.strength);
    const eta = item.expectedBackInStockDate ? new Date(item.expectedBackInStockDate) : null;
    const etaTs = eta && !Number.isNaN(eta.getTime()) ? eta.getTime() : null;

    if (!grouped.has(drug)) {
      grouped.set(drug, { drug, doses: new Set(), expectedBackInStockDate: null, etaTs: null });
    }

    const row = grouped.get(drug);
    doses.forEach((d) => row.doses.add(d));
    if (etaTs !== null && (row.etaTs === null || etaTs < row.etaTs)) {
      row.etaTs = etaTs;
      row.expectedBackInStockDate = new Date(etaTs).toISOString();
    }
  }

  return [...grouped.values()]
    .sort((a, b) => a.drug.localeCompare(b.drug))
    .map((row) => ({
      drug: row.drug,
      doses: [...row.doses].sort(),
      expectedBackInStockDate: row.expectedBackInStockDate
    }));
}
