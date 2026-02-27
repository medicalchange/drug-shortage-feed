function getConfig() {
  return {
    apiBaseUrl: process.env.HPS_API_BASE_URL || 'https://healthproductshortages.ca/api/v1',
    pageSize: Number(process.env.HPS_PAGE_SIZE || 100),
    maxRecords: Number(process.env.HPS_MAX_RECORDS || 2000)
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function normalizeReport(item) {
  const reportId = item.report_id || item.id || item.shortage_report_id || item.discontinuance_report_id;
  const reportType =
    (typeof item.type === 'string' ? item.type : item.type?.label) ||
    (item.discontinuance_report_id ? 'discontinuation' : 'shortage');
  const brandName = item.brand_name || item.en_drug_brand_name || item.drug?.brand_name || null;
  const dosageForm = item.dosage_form || item.drug_dosage_form || null;
  const route = item.route || item.drug_route || null;
  const strength = item.strength || item.drug_strength || null;
  const packageQuantity = item.drug_package_quantity || item.package_quantity || null;
  const expectedBackInStockDate = normalizeDate(item.estimated_end_date);
  const actualStartDate = normalizeDate(item.actual_start_date);
  const actualEndDate = normalizeDate(item.actual_end_date);
  const resolved = item.resolved === true;

  return {
    id: `${reportType}:${reportId}`,
    reportId: reportId || null,
    type: reportType || null,
    brandName,
    companyName: item.company_name || null,
    status: item.status || null,
    din: item.din || null,
    route,
    dosageForm,
    strength,
    packageQuantity,
    expectedBackInStockDate,
    actualStartDate,
    actualEndDate,
    resolved,
    updatedDate: normalizeDate(item.updated_date),
    postedDate: normalizeDate(item.created_at || item.created_date || item.post_date),
    updatedAt: normalizeDate(item.updated_at),
    updateDate: normalizeDate(item.updated_date || item.updated_at)
  };
}

async function loginAndGetToken() {
  const { apiBaseUrl } = getConfig();
  const email = process.env.HPS_EMAIL;
  const password = process.env.HPS_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing credentials. Set HPS_EMAIL and HPS_PASSWORD.');
  }

  const body = new URLSearchParams({ email, password });
  const response = await fetch(`${apiBaseUrl}/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const token = response.headers.get('auth-token');
  if (!token) {
    throw new Error('Login succeeded but no auth-token header was returned.');
  }

  return token;
}

function buildSearchParams(offset, pageSize) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    orderby: 'updated_date',
    order: 'desc'
  });

  if (process.env.HPS_TERM) params.set('term', process.env.HPS_TERM);
  if (process.env.HPS_DIN) params.set('din', process.env.HPS_DIN);
  if (process.env.HPS_REPORT_ID) params.set('report_id', process.env.HPS_REPORT_ID);
  if (process.env.HPS_FILTER_STATUS) params.set('filter_status', process.env.HPS_FILTER_STATUS);

  return params;
}

async function fetchSearchPage(token, offset = 0) {
  const { apiBaseUrl, pageSize } = getConfig();
  const params = buildSearchParams(offset, pageSize);
  const response = await fetch(`${apiBaseUrl}/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'auth-token': token
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Search failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  return {
    total: Number(payload.total || 0),
    limit: Number(payload.limit || pageSize),
    offset: Number(payload.offset || offset),
    totalPages: Number(payload.total_pages || 0),
    data: Array.isArray(payload.data) ? payload.data : []
  };
}

export async function fetchAllShortages() {
  const { pageSize, maxRecords } = getConfig();
  const token = await loginAndGetToken();
  const all = [];

  let offset = 0;
  let total = null;
  while (total === null || offset < total) {
    if (offset >= maxRecords) break;
    const page = await fetchSearchPage(token, offset);
    total = page.total;
    all.push(...page.data.map(normalizeReport));
    if (page.data.length === 0) break;
    offset += page.limit || pageSize;
  }

  all.sort((a, b) => {
    const aDate = new Date(a.updateDate || 0).getTime();
    const bDate = new Date(b.updateDate || 0).getTime();
    return bDate - aDate;
  });

  return all;
}
