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

    const rows = items
      .slice(0, config.limit)
      .map((item) => {
        const name = item.brandName || 'Unnamed product';
        const company = item.companyName || 'Unknown company';
        const updated = fmtDate(item.updateDate || item.updatedDate || item.postedDate);
        const reportType = item.type || 'shortage';
        const strength = item.strength ? String(item.strength).replace(/\r?\n/g, ', ') : 'n/a';
        const pack = item.packageQuantity ? String(item.packageQuantity).replace(/\r?\n/g, ', ') : 'n/a';
        const eta = fmtDate(item.expectedBackInStockDate);

        return `
          <li class="ds-item">
            <h4>${escapeHtml(name)}</h4>
            <p><strong>Company:</strong> ${escapeHtml(company)}</p>
            <p><strong>Type:</strong> ${escapeHtml(reportType)}</p>
            <p><strong>Status:</strong> ${escapeHtml(item.status || 'Unknown')}</p>
            <p><strong>DIN:</strong> ${escapeHtml(item.din || 'n/a')}</p>
            <p><strong>Dose/Strength:</strong> ${escapeHtml(strength)}</p>
            <p><strong>Pack Size:</strong> ${escapeHtml(pack)}</p>
            <p><strong>Expected Back In Stock:</strong> ${escapeHtml(eta)}</p>
            <p><strong>Updated:</strong> ${escapeHtml(updated)}</p>
          </li>
        `;
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
      .ds-item { border: 1px solid #eef2f7; border-radius: 8px; padding: 10px; }
      .ds-item h4 { margin: 0 0 6px; font-size: 15px; }
      .ds-item p { margin: 3px 0; font-size: 13px; }
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
