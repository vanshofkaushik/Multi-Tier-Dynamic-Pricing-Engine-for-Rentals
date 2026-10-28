/**
 * DynamicRent - Owner Module: Price History Audit Log (js/owner/priceHistory.js)
 * Step 3B: Connects the Price History page to the Express backend & MongoDB Atlas.
 * 
 * ARCHITECTURAL REQUIREMENTS:
 * - Fetches saved pricing calculation quotes from MongoDB Atlas via ApiClient.getPricingHistory().
 * - Displays records sorted newest-first with transparent factor multipliers.
 * - Dynamically populates property filters from backend properties.
 * - Supports searching and direction filtering (increases vs decreases).
 * - Provides loading, empty, and API-error states.
 * - Preserves existing KPI counters, table layout, and styling.
 */

let currentOwner = null;
let ownerProperties = [];
let allHistoryRecords = [];
let historyListenersBound = false;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('price-history-tbody')) {
      initPriceHistoryPage();
    }
  });
}

/**
 * Initialize Price History Page, verify owner authentication, and fetch records
 */
async function initPriceHistoryPage() {
  const loadingEl = document.getElementById('history-loading-state');
  const errorEl = document.getElementById('history-api-error-state');
  const tableCard = document.getElementById('history-table-card');

  try {
    // 1. Ensure seed users are initialized if available
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    // 2. Fetch authenticated owner from session (fallback to demo owner OWN001)
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      currentOwner = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      currentOwner = getCurrentUser();
    }

    if (!currentOwner || currentOwner.role !== 'owner') {
      const users = typeof StorageUtils !== 'undefined' && typeof StorageUtils.getUsers === 'function'
        ? StorageUtils.getUsers()
        : (typeof DEFAULT_DEMO_USERS !== 'undefined' ? DEFAULT_DEMO_USERS : []);
      const demoOwner = users.find(u => u.role === 'owner');
      if (demoOwner) {
        currentOwner = demoOwner;
      }
    }

    if (!currentOwner || currentOwner.role !== 'owner') {
      console.warn('[PriceHistory] Owner session missing or role invalid. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
        return;
      }
    }

    // Update Header profile display
    updateHeaderProfile(currentOwner);

    // 3. Ensure ApiClient is available
    if (!window.ApiClient || typeof window.ApiClient.getPricingHistory !== 'function') {
      throw new Error('ApiClient is not loaded or missing getPricingHistory method. Please ensure js/utils/api.js is included.');
    }

    // Clear stale database-dependent history table before fetching
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';

    // 4. Fetch owner properties from backend
    await fetchOwnerProperties();

    // 5. Bind filter and search listeners (once)
    bindHistoryFilterListeners();

    // 6. Load and render price history
    await loadAndRenderPriceHistory();

  } catch (err) {
    console.error('[PriceHistory Properties Source: None - Backend Offline/Error]', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('history-api-error-message');
      if (msgEl) {
        msgEl.textContent = 'Unable to connect to the server. Please try again.';
      }
    }
  }
}

/**
 * Update Header user profile information
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
 * Fetch owner's properties to populate the property filter dropdown
 */
async function fetchOwnerProperties() {
  const selectEl = document.getElementById('history-property-filter');
  if (!selectEl) return;

  const ownerId = currentOwner ? (currentOwner.id || currentOwner._id) : 'OWN001';

  console.log('[PriceHistory Properties Source: Requesting from backend API...]');
  const props = await window.ApiClient.getProperties({ ownerId });
  if (Array.isArray(props)) {
    ownerProperties = props.filter(p => String(p.ownerId).trim() === String(ownerId).trim());
    console.log(`[PriceHistory Properties Source: Backend API returned ${ownerProperties.length} properties]`, ownerProperties);
  } else {
    ownerProperties = [];
  }

  selectEl.innerHTML = '<option value="all">All Properties</option>';
  ownerProperties.forEach(p => {
    const opt = document.createElement('option');
    opt.value = String(p._id || p.id);
    opt.textContent = p.title || p.name || 'Untitled Property';
    selectEl.appendChild(opt);
  });
}

/**
 * Bind search, property, and direction filter listeners
 */
function bindHistoryFilterListeners() {
  if (historyListenersBound) return;
  historyListenersBound = true;

  const searchInput = document.getElementById('history-search-input');
  const propFilter = document.getElementById('history-property-filter');
  const dirFilter = document.getElementById('history-direction-filter');
  const resetBtn = document.getElementById('history-reset-btn');

  if (searchInput) searchInput.addEventListener('input', applyHistoryFilters);
  if (propFilter) propFilter.addEventListener('change', loadAndRenderPriceHistory);
  if (dirFilter) dirFilter.addEventListener('change', applyHistoryFilters);
  if (resetBtn) resetBtn.addEventListener('click', resetHistoryFilters);
}

/**
 * Load pricing history records from MongoDB backend via ApiClient.getPricingHistory()
 */
async function loadAndRenderPriceHistory() {
  const loadingEl = document.getElementById('history-loading-state');
  const errorEl = document.getElementById('history-api-error-state');
  const tableCard = document.getElementById('history-table-card');
  const propFilter = document.getElementById('history-property-filter');

  const selectedPropId = propFilter ? propFilter.value : 'all';

  if (loadingEl) loadingEl.style.display = 'block';
  if (errorEl) errorEl.style.display = 'none';

  try {
    let rawRecords = [];

    if (selectedPropId !== 'all') {
      // Fetch history for specific property
      rawRecords = await window.ApiClient.getPricingHistory(selectedPropId, 100);
      const propObj = ownerProperties.find(p => String(p._id || p.id) === selectedPropId);
      rawRecords = rawRecords.map(r => ({
        ...r,
        propertyName: (propObj && (propObj.title || propObj.name)) || 'Property',
        propertyId: selectedPropId
      }));
    } else {
      // Fetch history across all owner properties
      if (ownerProperties.length === 0) {
        await fetchOwnerProperties();
      }

      const results = await Promise.all(
        ownerProperties.map(async p => {
          try {
            const pId = String(p._id || p.id);
            const history = await window.ApiClient.getPricingHistory(pId, 50);
            return history.map(r => ({
              ...r,
              propertyName: p.title || p.name || 'Property',
              propertyId: pId
            }));
          } catch (e) {
            return [];
          }
        })
      );

      rawRecords = results.flat();
    }

    // Sort newest-first based on createdAt timestamp
    rawRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    allHistoryRecords = rawRecords;

    if (loadingEl) loadingEl.style.display = 'none';
    if (tableCard) tableCard.style.display = 'block';

    // Update KPI cards
    updateHistoryKpis(allHistoryRecords);

    // Apply active search/direction filters and render table
    applyHistoryFilters();

  } catch (err) {
    console.error('[PriceHistory] Error loading pricing history:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('history-api-error-message');
      if (msgEl) {
        msgEl.textContent = err.message || 'Could not retrieve pricing history from backend.';
      }
    }
  }
}

/**
 * Update summary KPI statistics for price calculations
 * @param {Array} records 
 */
function updateHistoryKpis(records) {
  const totalCount = records.length;
  const increases = records.filter(r => (r.calculatedPrice || 0) > (r.basePrice || 0)).length;
  const decreases = records.filter(r => (r.calculatedPrice || 0) < (r.basePrice || 0)).length;
  
  const avgShift = totalCount > 0 
    ? Math.round(records.reduce((sum, r) => sum + ((r.calculatedPrice || 0) - (r.basePrice || 0)), 0) / totalCount)
    : 0;

  const totalEl = document.getElementById('hist-stat-total');
  const avgEl = document.getElementById('hist-stat-avg');
  const incEl = document.getElementById('hist-stat-inc');
  const decEl = document.getElementById('hist-stat-dec');

  if (totalEl) totalEl.textContent = totalCount.toString();
  if (avgEl) avgEl.textContent = `${avgShift >= 0 ? '+' : ''}₹${avgShift.toLocaleString('en-IN')}`;
  if (incEl) incEl.textContent = increases.toString();
  if (decEl) decEl.textContent = decreases.toString();
}

/**
 * Apply search and direction filters to history records and render table rows
 */
function applyHistoryFilters() {
  const searchInput = document.getElementById('history-search-input');
  const dirFilter = document.getElementById('history-direction-filter');
  const tbody = document.getElementById('price-history-tbody');
  const countEl = document.getElementById('history-results-count');

  if (!tbody) return;

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const dirVal = dirFilter ? dirFilter.value : 'all';

  let filtered = allHistoryRecords.filter(r => {
    const diff = (r.calculatedPrice || 0) - (r.basePrice || 0);
    if (dirVal === 'increase' && diff <= 0) return false;
    if (dirVal === 'decrease' && diff >= 0) return false;

    if (query) {
      const matchProp = (r.propertyName || '').toLowerCase().includes(query);
      const matchId = String(r._id || '').toLowerCase().includes(query);
      const matchPropId = String(r.propertyId || '').toLowerCase().includes(query);
      if (!matchProp && !matchId && !matchPropId) return false;
    }

    return true;
  });

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${allHistoryRecords.length} audit records`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
          <div style="font-size: 1.6rem; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">No price calculation records found.</div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">Quotes calculated on the Dynamic Pricing page will appear here as an audit trail.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    let formattedDate = '--';
    if (r.createdAt) {
      const rawDate = typeof r.createdAt === 'string' ? r.createdAt.split('T')[0] : r.createdAt;
      formattedDate = (typeof DateUtils !== 'undefined' && typeof DateUtils.formatDate === 'function')
        ? DateUtils.formatDate(rawDate)
        : new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const recordId = String(r._id || '');
    const shortId = recordId.length > 8 ? recordId.slice(-6).toUpperCase() : recordId;
    const basePrice = r.basePrice || 0;
    const calcPrice = r.calculatedPrice || 0;
    const priceDiff = calcPrice - basePrice;
    const isPositive = priceDiff >= 0;
    const badgeClass = priceDiff > 0 ? 'badge-success' : (priceDiff < 0 ? 'badge-warning' : 'badge-neutral');
    const changeSign = isPositive ? '+' : '';
    const pct = basePrice > 0 ? Math.round((priceDiff / basePrice) * 1000) / 10 : 0;
    const changeText = `${changeSign}₹${Math.abs(priceDiff).toLocaleString('en-IN')} (${changeSign}${pct}%)`;

    // Multiplier factors summary
    const mult = r.multipliers || {};
    const clamped = mult.clampedMultiplier !== undefined ? mult.clampedMultiplier : 1.0;
    const occRate = r.occupancyRate !== undefined ? r.occupancyRate : 0;
    const demand = r.demandScore !== undefined ? r.demandScore : 0;
    const duration = r.durationDays || 1;
    const leadTime = r.leadTimeDays || 0;

    return `
      <tr>
        <td style="font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
          <strong>${formattedDate}</strong>
          <div style="font-size: 0.74rem; color: var(--text-muted);" title="Quote ID: ${recordId}">#${shortId}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${r.propertyName || 'Property'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);" title="Property ID: ${r.propertyId}">ID: ${String(r.propertyId).slice(-6).toUpperCase()}</div>
        </td>
        <td style="font-weight: 600; color: var(--text-secondary);">
          ₹${basePrice.toLocaleString('en-IN')}
        </td>
        <td style="font-weight: 800; color: var(--primary-dark); font-size: 0.95rem;">
          ₹${calcPrice.toLocaleString('en-IN')}
        </td>
        <td>
          <span class="badge ${badgeClass}">${changeText}</span>
        </td>
        <td style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">
          <div><strong>Stay Window:</strong> ${duration}N duration, ${leadTime}d advance lead time</div>
          <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">
            Occupancy: ${occRate}% • Demand: ${demand}/100 • Net Multiplier: <strong>${clamped}x</strong>
          </div>
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

  loadAndRenderPriceHistory();
}

// Support CommonJS export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPriceHistoryPage,
    fetchOwnerProperties,
    loadAndRenderPriceHistory,
    updateHistoryKpis,
    applyHistoryFilters,
    resetHistoryFilters
  };
}
