/**
 * DynamicRent - Owner Module: Pricing Page UI Controller (js/owner/pricingPage.js)
 * Step 8: Manages property selection, live date adjustments, multiplier rendering,
 * transparent breakdown display, and the manual price approval workflow.
 */

let activeOwner = null;
let currentPricingData = null;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initPricingPage();
  });
}

/**
 * Initialize Pricing Page controls, populate listings, and bind live change listeners
 */
function initPricingPage() {
  try {
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();
    if (typeof initDefaultBookings === 'function') initDefaultBookings();

    activeOwner = StorageUtils.getCurrentUser();
    if (!activeOwner || activeOwner.role !== 'owner') {
      redirectToLogin();
      return;
    }

    // 1. Update Header Profile
    updateHeaderProfile(activeOwner);

    // 2. Set default date to today
    const dateInput = document.getElementById('pricing-date-input');
    if (dateInput) {
      const todayStr = (typeof DateUtils !== 'undefined') 
        ? DateUtils.getTodayDateString() 
        : new Date().toISOString().split('T')[0];
      dateInput.value = todayStr;
      dateInput.min = todayStr; // Prevent choosing past dates for pricing recommendations
    }

    // 3. Populate property dropdown with current owner's properties ONLY
    populateOwnerPropertyDropdown(activeOwner.id);

    // 4. Bind change listeners
    bindPricingListeners();

    // 5. Initial dynamic calculation
    recalculatePricing();

  } catch (err) {
    console.error('Error initializing dynamic pricing page:', err);
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
 * Populate property dropdown with owner's properties only
 * @param {string} ownerId 
 */
function populateOwnerPropertyDropdown(ownerId) {
  const selectEl = document.getElementById('pricing-property-select');
  if (!selectEl) return;

  const properties = StorageUtils.getOwnerProperties(ownerId);
  if (properties.length === 0) {
    selectEl.innerHTML = '<option value="">No properties available</option>';
    return;
  }

  // Check URL query parameters for ?id=PROPxxx preselection
  const urlParams = new URLSearchParams(window.location.search);
  const requestedPropId = urlParams.get('id');

  selectEl.innerHTML = properties.map(p => {
    const isSelected = (requestedPropId && p.id.toUpperCase() === requestedPropId.toUpperCase()) 
      ? 'selected' 
      : '';
    const locStr = p.area ? `${p.area}, ${p.location}` : p.location;
    return `<option value="${p.id}" ${isSelected}>${p.name} (${locStr})</option>`;
  }).join('');
}

/**
 * Bind change listeners for property select and date input
 */
function bindPricingListeners() {
  const selectEl = document.getElementById('pricing-property-select');
  const dateInput = document.getElementById('pricing-date-input');
  const approveBtn = document.getElementById('btn-approve-price');

  if (selectEl) {
    selectEl.addEventListener('change', () => recalculatePricing());
  }

  if (dateInput) {
    dateInput.addEventListener('change', () => recalculatePricing());
  }

  if (approveBtn) {
    approveBtn.addEventListener('click', handleApprovePrice);
  }
}

/**
 * Recalculate dynamic pricing for the selected property and date
 */
function recalculatePricing() {
  const selectEl = document.getElementById('pricing-property-select');
  const dateInput = document.getElementById('pricing-date-input');

  if (!selectEl || !selectEl.value) return;

  const propertyId = selectEl.value;
  const targetDate = dateInput ? dateInput.value : '';

  if (typeof PricingEngine === 'undefined') {
    console.error('PricingEngine module not loaded.');
    return;
  }

  currentPricingData = PricingEngine.calculateDynamicPrice(propertyId, targetDate);
  renderPricingCockpit(currentPricingData);
}

/**
 * Render the entire Pricing Cockpit UI with live calculated metrics
 * @param {Object} data 
 */
function renderPricingCockpit(data) {
  if (!data) return;

  // 1. Current State Card
  const currentPriceEl = document.getElementById('current-price-val');
  if (currentPriceEl) currentPriceEl.textContent = `₹${data.currentPrice.toLocaleString('en-IN')}`;

  const basePriceEl = document.getElementById('base-price-val');
  if (basePriceEl) basePriceEl.textContent = `₹${data.basePrice.toLocaleString('en-IN')}`;

  const rangePriceEl = document.getElementById('price-range-val');
  if (rangePriceEl) rangePriceEl.textContent = `₹${data.minPrice.toLocaleString('en-IN')} – ₹${data.maxPrice.toLocaleString('en-IN')}`;

  // 2. Factors Grid
  // Occupancy
  const occValEl = document.getElementById('factor-occupancy-val');
  const occBadgeEl = document.getElementById('factor-occupancy-badge');
  if (occValEl) occValEl.textContent = `${data.occupancy}%`;
  if (occBadgeEl) {
    const occPct = data.breakdown.occupancyPct;
    occBadgeEl.textContent = `${occPct >= 0 ? '+' : ''}${occPct}%`;
    occBadgeEl.className = `badge ${occPct > 0 ? 'badge-success' : (occPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Demand
  const demValEl = document.getElementById('factor-demand-val');
  const demBadgeEl = document.getElementById('factor-demand-badge');
  if (demValEl) demValEl.textContent = `${data.demandLevel} (${data.demandScore}/100)`;
  if (demBadgeEl) {
    const demPct = data.breakdown.demandPct;
    demBadgeEl.textContent = `${demPct >= 0 ? '+' : ''}${demPct}%`;
    demBadgeEl.className = `badge ${demPct > 0 ? 'badge-success' : (demPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Season
  const seasonValEl = document.getElementById('factor-season-val');
  const seasonBadgeEl = document.getElementById('factor-season-badge');
  if (seasonValEl) seasonValEl.textContent = data.seasonName;
  if (seasonBadgeEl) {
    const seaPct = data.breakdown.seasonPct;
    seasonBadgeEl.textContent = `${seaPct >= 0 ? '+' : ''}${seaPct}%`;
    seasonBadgeEl.className = `badge ${seaPct > 0 ? 'badge-success' : (seaPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Day of Week
  const dayValEl = document.getElementById('factor-day-val');
  const dayBadgeEl = document.getElementById('factor-day-badge');
  if (dayValEl) dayValEl.textContent = data.dayName;
  if (dayBadgeEl) {
    const dayPct = data.breakdown.dayPct;
    dayBadgeEl.textContent = `${dayPct >= 0 ? '+' : ''}${dayPct}%`;
    dayBadgeEl.className = `badge ${dayPct > 0 ? 'badge-success' : 'badge-neutral'}`;
  }

  // Amenities
  const amenityBadgeEl = document.getElementById('factor-amenity-badge');
  if (amenityBadgeEl) {
    const amPct = data.breakdown.amenityPct;
    amenityBadgeEl.textContent = `+${amPct}%`;
    amenityBadgeEl.className = 'badge badge-primary';
  }

  // 3. Recommended Price Card (Highlighted CTA)
  const recPriceEl = document.getElementById('recommended-price-display');
  if (recPriceEl) recPriceEl.textContent = `₹${data.recommendedPrice.toLocaleString('en-IN')}`;

  const recCurrentEl = document.getElementById('recommended-current-baseline');
  if (recCurrentEl) recCurrentEl.textContent = `Current Rate: ₹${data.currentPrice.toLocaleString('en-IN')} / night`;

  const changePillEl = document.getElementById('recommended-price-change');
  if (changePillEl) {
    const isPositive = data.priceChange >= 0;
    const sign = isPositive ? '+' : '';
    changePillEl.textContent = `${sign}₹${Math.abs(data.priceChange).toLocaleString('en-IN')} (${sign}${data.priceChangePercent}%) vs Current`;
    changePillEl.style.color = isPositive ? 'var(--primary-dark)' : 'var(--danger)';
    changePillEl.style.fontWeight = '700';
  }

  // Dynamic explanation
  const explanationEl = document.getElementById('pricing-explanation-text');
  if (explanationEl) {
    explanationEl.textContent = data.explanation;
  }

  // Update button text & status
  const approveBtn = document.getElementById('btn-approve-price');
  if (approveBtn) {
    if (data.recommendedPrice === data.currentPrice) {
      approveBtn.textContent = '✓ Current Rate Matches Recommendation';
      approveBtn.disabled = true;
    } else {
      approveBtn.textContent = `Approve New Price (₹${data.recommendedPrice.toLocaleString('en-IN')})`;
      approveBtn.disabled = false;
    }
  }

  // 4. Transparent Breakdown Table
  renderBreakdownTable(data);
}

/**
 * Render itemized calculation breakdown table
 * @param {Object} data 
 */
function renderBreakdownTable(data) {
  const tbody = document.getElementById('pricing-breakdown-tbody');
  if (!tbody) return;

  const rows = [
    { factor: 'Base Reference Price', formula: 'Starting Property Base Anchor', impact: `₹${data.basePrice.toLocaleString('en-IN')}`, isBold: true },
    { factor: 'Occupancy Multiplier', formula: `Occupancy at ${data.occupancy}%`, impact: `${data.breakdown.occupancyPct >= 0 ? '+' : ''}${data.breakdown.occupancyPct}%` },
    { factor: 'Market Demand Multiplier', formula: `Demand Tier: ${data.demandLevel} (${data.demandScore}/100)`, impact: `${data.breakdown.demandPct >= 0 ? '+' : ''}${data.breakdown.demandPct}%` },
    { factor: 'Seasonality Factor', formula: `${data.seasonName} adjustment`, impact: `${data.breakdown.seasonPct >= 0 ? '+' : ''}${data.breakdown.seasonPct}%` },
    { factor: 'Day of Week Surge', formula: `${data.dayName} rate calculation`, impact: `${data.breakdown.dayPct >= 0 ? '+' : ''}${data.breakdown.dayPct}%` },
    { factor: 'Amenity Premium', formula: 'Verified high-value amenities (pool, AC, gym, view)', impact: `+${data.breakdown.amenityPct}%` },
    { factor: 'Calculated Raw Price', formula: 'Base × Compound Multipliers', impact: `₹${data.rawCalculatedPrice.toLocaleString('en-IN')}` },
    { factor: 'Safety Range Clamping', formula: `Bounded within [₹${data.minPrice.toLocaleString('en-IN')}, ₹${data.maxPrice.toLocaleString('en-IN')}]`, impact: `₹${data.clampedPrice.toLocaleString('en-IN')}` },
    { factor: 'Final Recommended Price', formula: 'Rounded to nearest ₹50', impact: `₹${data.recommendedPrice.toLocaleString('en-IN')}`, isTotal: true }
  ];

  tbody.innerHTML = rows.map(r => {
    let rowStyle = '';
    let valStyle = 'font-weight: 600; color: var(--text-primary);';

    if (r.isTotal) {
      rowStyle = 'background: var(--primary-light); font-weight: 800;';
      valStyle = 'font-size: 1.05rem; color: var(--primary-dark); font-weight: 800;';
    } else if (r.isBold) {
      valStyle = 'font-weight: 700; color: var(--text-primary);';
    }

    return `
      <tr style="${rowStyle}">
        <td style="padding: 10px 14px; font-weight: 700;">${r.factor}</td>
        <td style="padding: 10px 14px; color: var(--text-secondary); font-size: 0.82rem;">${r.formula}</td>
        <td style="padding: 10px 14px; text-align: right; ${valStyle}">${r.impact}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Handle Owner Approval of the Recommended Price
 */
function handleApprovePrice() {
  if (!activeOwner || !currentPricingData) return;

  const propertyId = currentPricingData.propertyId;
  const property = StorageUtils.getPropertyById(propertyId);

  // 1. Authorization check: Verify property belongs to logged-in owner
  if (!property || property.ownerId !== activeOwner.id) {
    showPricingToast('You are not authorized to modify this property.', 'error');
    return;
  }

  const oldPrice = property.currentPrice || property.pricePerNight || property.basePrice;
  const newPrice = currentPricingData.recommendedPrice;

  if (oldPrice === newPrice) {
    showPricingToast('Current price already matches the recommended price.', 'warning');
    return;
  }

  // 2. Update property.currentPrice in dynamicRentProperties
  const allProperties = StorageUtils.getProperties();
  const propIndex = allProperties.findIndex(p => p.id === propertyId);

  if (propIndex === -1) {
    showPricingToast('Property record not found in storage.', 'error');
    return;
  }

  allProperties[propIndex].currentPrice = newPrice;
  StorageUtils.saveProperties(allProperties);

  // 3. Create price history audit log entry
  if (typeof PriceHistoryManager !== 'undefined') {
    PriceHistoryManager.addRecord({
      propertyId: property.id,
      propertyName: property.name,
      oldPrice,
      newPrice,
      priceChange: currentPricingData.priceChange,
      priceChangePercent: currentPricingData.priceChangePercent,
      reason: currentPricingData.explanation,
      changedBy: activeOwner.id,
      changedByName: activeOwner.name || 'Owner',
      changedAt: new Date().toISOString()
    });
  }

  // 4. Display success feedback toast
  showPricingToast(`Price updated successfully from ₹${oldPrice.toLocaleString('en-IN')} to ₹${newPrice.toLocaleString('en-IN')}`, 'success');

  // 5. Recalculate & update UI
  recalculatePricing();
}

/**
 * Display a toast notification on the pricing page
 * @param {string} message 
 * @param {string} [type] 
 */
function showPricingToast(message, type = 'success') {
  let container = document.getElementById('owner-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'owner-toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}
