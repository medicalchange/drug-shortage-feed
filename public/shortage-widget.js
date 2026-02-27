(function () {
  const defaultConfig = {
    apiBaseUrl: '',
    mountSelector: '#drug-shortage-widget',
    mode: 'new',
    statusFilter: 'active',
    typeFilter: 'shortage',
    resolvedFilter: 'false',
    requireEta: false,
    limit: 25,
    title: 'Drug Shortage Alerts'
  };

  function fmtDate(value) {
    if (!value) return 'n/a';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'n/a';
    return d.toLocaleDateString();
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isActiveStatus(value) {
    return String(value || '').toLowerCase().includes('active');
  }

  async function load(config) {
    const endpoint = config.mode === 'all' ? '/api/shortages' : '/api/shortages/new';
    const params = new URLSearchParams({ limit: String(config.limit) });
    if (config.statusFilter) params.set('status', config.statusFilter);
    if (config.typeFilter) params.set('type', config.typeFilter);
    if (typeof config.resolvedFilter === 'string') params.set('resolved', config.resolvedFilter);
    if (config.requireEta === true) params.set('require_eta', 'true');
    const url = `${config.apiBaseUrl}${endpoint}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json();
  }

  function render(container, data, config) {
    const all = data.results || [];
    const items = config.statusFilter && config.statusFilter.toLowerCase() === 'active'
      ? all.filter((item) => isActiveStatus(item.status))
      : all;

    if (items.length === 0) {
      container.innerHTML = `<div class="ds-card"><h3>${escapeHtml(config.title)}</h3><p>No active shortages found.</p></div>`;
      return;
    }

    const grouped = new Map();
    for (const item of items) {
      const name = (item.brandName || 'Unnamed product').trim();
      const doses = (item.strength ? String(item.strength) : '')
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);
      const eta = item.expectedBackInStockDate ? new Date(item.expectedBackInStockDate) : null;
      const etaTs = eta && !Number.isNaN(eta.getTime()) ? eta.getTime() : null;

      if (!grouped.has(name)) {
        grouped.set(name, {
          name,
          doses: new Set(),
          earliestEtaTs: etaTs
        });
      }

      const current = grouped.get(name);
      doses.forEach((d) => current.doses.add(d));
      if (etaTs !== null && (current.earliestEtaTs === null || etaTs < current.earliestEtaTs)) {
        current.earliestEtaTs = etaTs;
      }
    }

    const rows = [...grouped.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, config.limit)
      .map((entry) => {
        const doseText = entry.doses.size ? [...entry.doses].sort().join(', ') : 'n/a';
        const etaText = entry.earliestEtaTs ? fmtDate(new Date(entry.earliestEtaTs).toISOString()) : 'n/a';
        return `<li class="ds-line"><strong>${escapeHtml(entry.name)}</strong> | Dose(s): ${escapeHtml(doseText)} | Expected back: ${escapeHtml(etaText)}</li>`;
      })
      .join('');

    container.innerHTML = `
      <div class="ds-card">
        <h3>${escapeHtml(config.title)}</h3>
        <ul class="ds-list">${rows}</ul>
      </div>
    `;
  }

  function ensureStyles() {
    if (document.getElementById('ds-widget-style')) return;

    const style = document.createElement('style');
    style.id = 'ds-widget-style';
    style.textContent = `
      .ds-card { border: 1px solid #d5dde8; border-radius: 10px; padding: 14px; background: #fff; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
      .ds-card h3 { margin: 0 0 10px; font-size: 18px; }
      .ds-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
      .ds-line { border: 1px solid #eef2f7; border-radius: 8px; padding: 10px; font-size: 13px; line-height: 1.35; }
    `;
    document.head.appendChild(style);
  }

  window.DrugShortageWidget = {
    async init(userConfig) {
      const config = { ...defaultConfig, ...(userConfig || {}) };
      const container = document.querySelector(config.mountSelector);

      if (!container) {
        throw new Error(`Mount element not found: ${config.mountSelector}`);
      }

      ensureStyles();
      container.innerHTML = '<div class="ds-card"><p>Loading shortages...</p></div>';

      try {
        const data = await load(config);
        render(container, data, config);
      } catch (error) {
        container.innerHTML = `<div class="ds-card"><p>Failed to load drug shortages: ${escapeHtml(error.message)}</p></div>`;
      }
    }
  };
})();
