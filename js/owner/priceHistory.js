/**
 * DynamicRent - Owner Module: Price History Audit Log (js/owner/priceHistory.js)
 * Step 8: Manages chronological price change logs, filter controls, and read-only audit trails.
 */

const PriceHistoryManager = {
  STORAGE_KEY: 'dynamicRentPriceHistory',

  /**
   * Get all price history records from localStorage
   * @returns {Array} Array of history record objects
   */
  getAllRecords() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to read price history from localStorage:', err);
      return [];
    }
  },

  /**
   * Save array of price history records to localStorage
   * @param {Array} records 
   */
  saveRecords(records) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('Failed to save price history to localStorage:', err);
    }
  },

  /**
   * Add a new price change audit log entry
   * @param {Object} recordData 
   * @returns {Object} Newly created record
   */
  addRecord(recordData) {
    const records = this.getAllRecords();
    const nextNum = records.length + 1;
    const recordId = `PRICE${String(nextNum).padStart(3, '0')}`;

    const newRecord = {
      id: recordId,
      propertyId: recordData.propertyId,
      propertyName: recordData.propertyName || 'Property',
      oldPrice: recordData.oldPrice || 0,
      newPrice: recordData.newPrice || 0,
      priceChange: recordData.priceChange || (recordData.newPrice - recordData.oldPrice),
      priceChangePercent: recordData.priceChangePercent || 
        (recordData.oldPrice > 0 ? Math.round(((recordData.newPrice - recordData.oldPrice) / recordData.oldPrice) * 1000) / 10 : 0),
      reason: recordData.reason || 'Dynamic rate optimization',
      changedBy: recordData.changedBy || 'OWN001',
      changedByName: recordData.changedByName || 'Demo Owner',
      changedAt: recordData.changedAt || new Date().toISOString()
    };

    records.unshift(newRecord); // Prepend so newest is first
    this.saveRecords(records);
    return newRecord;
  },

  /**
   * Get price history for properties owned by a specific owner
   * @param {string} ownerId 
   * @returns {Array} Filtered records
   */
  getHistoryByOwner(ownerId) {
    if (!ownerId || typeof StorageUtils === 'undefined') return this.getAllRecords();
    const ownerProperties = StorageUtils.getOwnerProperties(ownerId);
    const ownerPropIds = new Set(ownerProperties.map(p => p.id));
    const allRecords = this.getAllRecords();
    return allRecords.filter(r => ownerPropIds.has(r.propertyId));
  },

  /**
   * Initialize initial demo price history logs if storage is empty
   */
  initDemoHistory() {
    const existing = this.getAllRecords();
    if (existing.length > 0) return;

    const demoRecords = [
      {
        id: "PRICE001",
        propertyId: "PROP001",
        propertyName: "Green Valley Villa",
        oldPrice: 3800,
        newPrice: 4500,
        priceChange: 700,
        priceChangePercent: 18.4,
        reason: "High weekend demand (Friday surge) and 64.5% occupancy",
        changedBy: "OWN001",
        changedByName: "Demo Owner",
        changedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
      },
      {
        id: "PRICE002",
        propertyId: "PROP002",
        propertyName: "Urban Heights Apartment",
        oldPrice: 2800,
        newPrice: 3200,
        priceChange: 400,
        priceChangePercent: 14.3,
        reason: "Occupancy rate threshold surpassed 70% in Bangalore",
        changedBy: "OWN001",
        changedByName: "Demo Owner",
        changedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString()
      },
      {
        id: "PRICE003",
        propertyId: "PROP003",
        propertyName: "Lake View Residence",
        oldPrice: 3400,
        newPrice: 3800,
        priceChange: 400,
        priceChangePercent: 11.8,
        reason: "Festive season adjustment and premium lakefront view",
        changedBy: "OWN001",
        changedByName: "Demo Owner",
        changedAt: new Date(Date.now() - 1000 * 60 * 60 * 140).toISOString()
      }
    ];

    this.saveRecords(demoRecords);
    console.log('Seeded demo price history records into localStorage (dynamicRentPriceHistory)');
  }
};

// Auto-seed demo history on load
PriceHistoryManager.initDemoHistory();

// ==========================================================================
// Price History Page UI Controller
// ==========================================================================

let currentOwnerPriceHistory = [];

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('price-history-tbody')) {
      initPriceHistoryPage();
    }
  });
}

/**
 * Initialize Price History Page
 */
function initPriceHistoryPage() {
  try {
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    const currentOwner = StorageUtils.getCurrentUser();
    if (!currentOwner || currentOwner.role !== 'owner') {
      redirectToLogin();
      return;
    }

    // Update Header
    updateHeaderProfile(currentOwner);

    // Populate property filter
    populatePropertyFilter(currentOwner.id);

    // Bind listeners
    bindHistoryFilterListeners();

    // Load and render table
    loadAndRenderPriceHistory(currentOwner.id);

  } catch (err) {
    console.error('Error initializing price history page:', err);
  }
}

/**
 * Update Header user details
 * @param {Object} owner 
 */
function updateHeaderProfile(owner) {
  const nameEl = document.getElementById('owner-name-display');
  if (nameEl) nameEl.textContent = owner.name || 'Owner';

  const avatarEl = document.getElementById('owner-avatar');
  if (avatarEl && owner.name) {
    const initials = owner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials || 'O';
  }
}

/**
 * Populate property filter dropdown
 * @param {string} ownerId 
 */
function populatePropertyFilter(ownerId) {
  const selectEl = document.getElementById('history-property-filter');
  if (!selectEl) return;

  const properties = StorageUtils.getOwnerProperties(ownerId);
  selectEl.innerHTML = '<option value="all">All Properties</option>';

  properties.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    selectEl.appendChild(opt);
  });
}

/**
 * Bind search, property, and direction filter listeners
 */
function bindHistoryFilterListeners() {
  const searchInput = document.getElementById('history-search-input');
  const propFilter = document.getElementById('history-property-filter');
  const dirFilter = document.getElementById('history-direction-filter');
  const resetBtn = document.getElementById('history-reset-btn');

  if (searchInput) searchInput.addEventListener('input', applyHistoryFilters);
  if (propFilter) propFilter.addEventListener('change', applyHistoryFilters);
  if (dirFilter) dirFilter.addEventListener('change', applyHistoryFilters);
  if (resetBtn) resetBtn.addEventListener('click', resetHistoryFilters);
}

/**
 * Load history records and render KPI cards and table
 * @param {string} ownerId 
 */
function loadAndRenderPriceHistory(ownerId) {
  currentOwnerPriceHistory = PriceHistoryManager.getHistoryByOwner(ownerId);
  updateHistoryKpis(currentOwnerPriceHistory);
  applyHistoryFilters();
}

/**
 * Update summary KPI statistics for price changes
 * @param {Array} records 
 */
function updateHistoryKpis(records) {
  const totalCount = records.length;
  const increases = records.filter(r => r.priceChange > 0).length;
  const decreases = records.filter(r => r.priceChange < 0).length;
  
  const avgChange = totalCount > 0 
    ? Math.round(records.reduce((sum, r) => sum + r.priceChange, 0) / totalCount)
    : 0;

  const totalEl = document.getElementById('hist-stat-total');
  const avgEl = document.getElementById('hist-stat-avg');
  const incEl = document.getElementById('hist-stat-inc');
  const decEl = document.getElementById('hist-stat-dec');

  if (totalEl) totalEl.textContent = totalCount.toString();
  if (avgEl) avgEl.textContent = `${avgChange >= 0 ? '+' : ''}₹${avgChange.toLocaleString('en-IN')}`;
  if (incEl) incEl.textContent = increases.toString();
  if (decEl) decEl.textContent = decreases.toString();
}

/**
 * Apply filters to history records and render table rows
 */
function applyHistoryFilters() {
  const searchInput = document.getElementById('history-search-input');
  const propFilter = document.getElementById('history-property-filter');
  const dirFilter = document.getElementById('history-direction-filter');
  const tbody = document.getElementById('price-history-tbody');
  const countEl = document.getElementById('history-results-count');

  if (!tbody) return;

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const propVal = propFilter ? propFilter.value : 'all';
  const dirVal = dirFilter ? dirFilter.value : 'all';

  let filtered = currentOwnerPriceHistory.filter(r => {
    if (propVal !== 'all' && r.propertyId !== propVal) return false;
    if (dirVal === 'increase' && r.priceChange <= 0) return false;
    if (dirVal === 'decrease' && r.priceChange >= 0) return false;

    if (query) {
      const matchProp = (r.propertyName || '').toLowerCase().includes(query);
      const matchReason = (r.reason || '').toLowerCase().includes(query);
      const matchId = (r.id || '').toLowerCase().includes(query);
      if (!matchProp && !matchReason && !matchId) return false;
    }

    return true;
  });

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${currentOwnerPriceHistory.length} audit records`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px 20px; color: var(--text-secondary);">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">📋</div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">No price history records found.</div>
          <div style="font-size: 0.82rem; color: var(--text-muted);">Adjust your search or filter options.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const formattedDate = (typeof DateUtils !== 'undefined') 
      ? DateUtils.formatDate(r.changedAt ? r.changedAt.split('T')[0] : '')
      : (r.changedAt || '');

    const isPositive = r.priceChange >= 0;
    const badgeClass = isPositive ? 'badge-success' : 'badge-warning';
    const changeSign = isPositive ? '+' : '';
    const changeText = `${changeSign}₹${Math.abs(r.priceChange).toLocaleString('en-IN')} (${changeSign}${r.priceChangePercent}%)`;

    return `
      <tr>
        <td style="font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
          <strong>${formattedDate}</strong>
          <div style="font-size: 0.74rem; color: var(--text-muted);">${r.id}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${r.propertyName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${r.propertyId}</div>
        </td>
        <td style="font-weight: 600; color: var(--text-secondary);">
          ₹${(r.oldPrice || 0).toLocaleString('en-IN')}
        </td>
        <td style="font-weight: 800; color: var(--primary-dark); font-size: 0.95rem;">
          ₹${(r.newPrice || 0).toLocaleString('en-IN')}
        </td>
        <td>
          <span class="badge ${badgeClass}">${changeText}</span>
        </td>
        <td style="font-size: 0.84rem; color: var(--text-secondary); max-width: 280px; line-height: 1.4;">
          ${r.reason}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Reset all history filters
 */
function resetHistoryFilters() {
  const searchInput = document.getElementById('history-search-input');
  const propFilter = document.getElementById('history-property-filter');
  const dirFilter = document.getElementById('history-direction-filter');

  if (searchInput) searchInput.value = '';
  if (propFilter) propFilter.value = 'all';
  if (dirFilter) dirFilter.value = 'all';

  applyHistoryFilters();
}
