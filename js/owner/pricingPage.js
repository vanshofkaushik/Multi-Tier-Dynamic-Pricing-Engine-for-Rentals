/**
 * DynamicRent - Owner Module: Pricing Page UI Controller (js/owner/pricingPage.js)
 * Step 3B: Connects the Dynamic Pricing page to the Express backend & MongoDB Atlas.
 * 
 * ARCHITECTURAL REQUIREMENTS:
 * - Fetches real properties using ApiClient.getProperties() and lets the owner select a property.
 * - Requests a dynamic quote using ApiClient.getPricingQuote(propertyId, checkIn, checkOut).
 * - Displays actual base price, suggested nightly price, estimated total stay price, duration,
 *   occupancy/demand information, and granular multipliers returned by the backend.
 * - Clearly explains that suggested prices are recommendations, never applied automatically.
 * - Supports explicit manual price update via ApiClient.updateProperty() on owner approval.
 * - Implements loading, empty, and API-error states.
 * - Preserves existing layout, design, and styling.
 */

let activeOwner = null;
let ownerProperties = [];
let currentSelectedProperty = null;
let currentPricingQuote = null;
let listenersBound = false;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initPricingPage();
  });
}

/**
 * Initialize Pricing Page controls, populate owner properties from backend, and bind live change listeners
 */
async function initPricingPage() {
  const loadingEl = document.getElementById('pricing-loading-state');
  const errorEl = document.getElementById('pricing-api-error-state');
  const cockpitEl = document.getElementById('pricing-cockpit-layout');

  try {
    // 1. Ensure seed users are initialized if available
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    // 2. Fetch authenticated owner from session (fallback to demo owner OWN001)
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      activeOwner = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      activeOwner = getCurrentUser();
    }

    if (!activeOwner || activeOwner.role !== 'owner') {
      const users = typeof StorageUtils !== 'undefined' && typeof StorageUtils.getUsers === 'function'
        ? StorageUtils.getUsers()
        : (typeof DEFAULT_DEMO_USERS !== 'undefined' ? DEFAULT_DEMO_USERS : []);
      const demoOwner = users.find(u => u.role === 'owner');
      if (demoOwner) {
        activeOwner = demoOwner;
      }
    }

    if (!activeOwner || activeOwner.role !== 'owner') {
      console.warn('[PricingPage] Owner session missing or role invalid. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
        return;
      }
    }

    // Update Header profile display
    updateHeaderProfile(activeOwner);

    // 3. Set default check-in and check-out dates
    setupDefaultDates();

    // 4. Ensure ApiClient is available
    if (!window.ApiClient || typeof window.ApiClient.getProperties !== 'function' || typeof window.ApiClient.getPricingQuote !== 'function') {
      throw new Error('ApiClient is not loaded or missing getPricingQuote method. Please ensure js/utils/api.js is included.');
    }

    // Clear stale database-dependent cockpit before fetching
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (cockpitEl) cockpitEl.style.display = 'none';

    // 5. Populate properties dropdown with owner's properties from backend
    await populateOwnerProperties();

    // 6. Bind live change listeners (once)
    bindPricingListeners();

    // 7. Initial dynamic quote calculation
    await recalculatePricing();

  } catch (err) {
    console.log('[Properties Source: None - Backend Offline] Pricing page zero properties due to error:', err.message);
    if (loadingEl) loadingEl.style.display = 'none';
    if (cockpitEl) cockpitEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('pricing-api-error-message');
      if (msgEl) {
        msgEl.textContent = 'Unable to connect to the server. Please try again.';
      }
    }
    showPricingToast('Unable to connect to the server. Please try again.', 'error');
  }
}

/**
 * Configure default check-in (tomorrow) and check-out (check-in + 3 days)
 */
function setupDefaultDates() {
  const checkInInput = document.getElementById('pricing-checkin-input');
  const checkOutInput = document.getElementById('pricing-checkout-input');
  const legacyDateInput = document.getElementById('pricing-date-input');

  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const threeDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4);

  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tomorrowStr = formatYMD(tomorrow);
  const checkoutStr = formatYMD(threeDaysLater);

  if (checkInInput) {
    if (!checkInInput.value) checkInInput.value = tomorrowStr;
    checkInInput.min = tomorrowStr;
  }

  if (checkOutInput) {
    if (!checkOutInput.value) checkOutInput.value = checkoutStr;
    checkOutInput.min = tomorrowStr;
  }

  if (legacyDateInput) {
    legacyDateInput.value = tomorrowStr;
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
 * Fetch owner's real properties from backend and populate select dropdown
 */
async function populateOwnerProperties() {
  const selectEl = document.getElementById('pricing-property-select');
  if (!selectEl) return;

  const ownerId = activeOwner ? (activeOwner.id || activeOwner._id) : 'OWN001';

  const props = await window.ApiClient.getProperties({ ownerId });
  if (Array.isArray(props)) {
    ownerProperties = props.filter(p => String(p.ownerId).trim() === String(ownerId).trim());
  } else {
    ownerProperties = [];
  }

  if (ownerProperties.length === 0) {
    selectEl.innerHTML = '<option value="">No properties available</option>';
    return;
  }

  // Check URL query parameters for ?id=... preselection
  let requestedPropId = '';
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    requestedPropId = urlParams.get('id') || '';
  }

  selectEl.innerHTML = ownerProperties.map(p => {
    const propId = String(p._id || p.id);
    const isSelected = requestedPropId && (propId.toLowerCase() === requestedPropId.toLowerCase());
    const title = p.title || p.name || 'Untitled Property';
    const loc = p.location ? ` (${p.location})` : '';
    return `<option value="${propId}" ${isSelected ? 'selected' : ''}>${title}${loc}</option>`;
  }).join('');

  // Set initially selected property
  const selectedId = selectEl.value;
  currentSelectedProperty = ownerProperties.find(p => String(p._id || p.id) === selectedId) || ownerProperties[0];
}

/**
 * Bind change and click event listeners
 */
function bindPricingListeners() {
  if (listenersBound) return;
  listenersBound = true;

  const selectEl = document.getElementById('pricing-property-select');
  const checkInInput = document.getElementById('pricing-checkin-input');
  const checkOutInput = document.getElementById('pricing-checkout-input');
  const legacyDateInput = document.getElementById('pricing-date-input');
  const approveBtn = document.getElementById('btn-approve-price');
  const declineBtn = document.getElementById('btn-decline-price');

  if (selectEl) {
    selectEl.addEventListener('change', () => {
      const selectedId = selectEl.value;
      currentSelectedProperty = ownerProperties.find(p => String(p._id || p.id) === selectedId) || null;
      recalculatePricing();
    });
  }

  if (checkInInput) {
    checkInInput.addEventListener('change', () => {
      if (legacyDateInput) legacyDateInput.value = checkInInput.value;
      // Auto adjust checkout if checkin >= checkout
      if (checkOutInput && checkInInput.value) {
        const inDate = new Date(checkInInput.value);
        const outDate = new Date(checkOutInput.value);
        if (isNaN(outDate.getTime()) || outDate <= inDate) {
          const nextDay = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate() + 3);
          const y = nextDay.getFullYear();
          const m = String(nextDay.getMonth() + 1).padStart(2, '0');
          const d = String(nextDay.getDate()).padStart(2, '0');
          checkOutInput.value = `${y}-${m}-${d}`;
        }
        checkOutInput.min = checkInInput.value;
      }
      recalculatePricing();
    });
  }

  if (checkOutInput) {
    checkOutInput.addEventListener('change', () => recalculatePricing());
  }

  if (approveBtn) {
    approveBtn.addEventListener('click', handleApprovePrice);
  }

  if (declineBtn) {
    declineBtn.addEventListener('click', handleDeclinePrice);
  }
}

/**
 * Recalculate dynamic pricing for the selected property and date window
 */
async function recalculatePricing() {
  const selectEl = document.getElementById('pricing-property-select');
  const checkInInput = document.getElementById('pricing-checkin-input');
  const checkOutInput = document.getElementById('pricing-checkout-input');
  const loadingEl = document.getElementById('pricing-loading-state');
  const errorEl = document.getElementById('pricing-api-error-state');
  const cockpitEl = document.getElementById('pricing-cockpit-layout');

  if (!selectEl || !selectEl.value) return;

  const propertyId = selectEl.value;
  const checkIn = checkInInput ? checkInInput.value : '';
  const checkOut = checkOutInput ? checkOutInput.value : '';

  if (!checkIn || !checkOut) {
    showPricingToast('Please select valid check-in and check-out dates.', 'warning');
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    showPricingToast('Check-out date must be strictly after check-in date.', 'warning');
    return;
  }

  // Update currentSelectedProperty
  currentSelectedProperty = ownerProperties.find(p => String(p._id || p.id) === propertyId) || currentSelectedProperty;

  // Show loading indicator
  if (loadingEl) loadingEl.style.display = 'block';
  if (errorEl) errorEl.style.display = 'none';

  try {
    // Request dynamic quote from backend
    const quote = await window.ApiClient.getPricingQuote(propertyId, checkIn, checkOut);
    currentPricingQuote = quote;

    if (loadingEl) loadingEl.style.display = 'none';
    if (cockpitEl) cockpitEl.style.display = 'grid';

    // Render calculated values into cockpit UI
    renderPricingCockpit(quote, currentSelectedProperty);

  } catch (err) {
    console.error('[PricingPage] Error calculating quote from backend:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (cockpitEl) cockpitEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('pricing-api-error-message');
      if (msgEl) msgEl.textContent = err.message || 'Could not calculate dynamic pricing quote from backend.';
    }
    showPricingToast(err.message || 'Failed to calculate dynamic pricing quote.', 'error');
  }
}

/**
 * Render the entire Pricing Cockpit UI with live metrics returned from backend
 * @param {Object} quote Calculated quote object from backend
 * @param {Object} property Target Property object
 */
function renderPricingCockpit(quote, property) {
  if (!quote || !property) return;

  const basePrice = (typeof quote.basePrice === 'number') 
    ? quote.basePrice 
    : (typeof property.basePrice === 'number' ? property.basePrice : (property.pricePerNight || 0));
  const suggestedPrice = quote.suggestedPricePerNight || quote.calculatedPrice || basePrice;
  const currentPrice = (typeof quote.currentPrice === 'number')
    ? quote.currentPrice
    : (typeof property.currentPrice === 'number' ? property.currentPrice : (property.pricePerNight || basePrice));
  const duration = quote.durationDays || 1;
  const leadTime = quote.leadTimeDays || 0;
  const occupancy = quote.occupancyRate || 0;
  const demand = quote.demandScore || 0;
  const bookingCount = quote.bookingCount || 0;
  const multipliers = quote.multipliers || {};

  // 1. Current State Card
  const currentPriceEl = document.getElementById('current-price-val');
  if (currentPriceEl) currentPriceEl.textContent = `₹${currentPrice.toLocaleString('en-IN')}`;

  const basePriceEl = document.getElementById('base-price-val');
  if (basePriceEl) basePriceEl.textContent = `₹${basePrice.toLocaleString('en-IN')}`;

  const minMult = multipliers.minAllowedMultiplier || 0.70;
  const maxMult = multipliers.maxAllowedMultiplier || 1.60;
  const rangePriceEl = document.getElementById('price-range-val');
  if (rangePriceEl) {
    const minBound = Math.round(basePrice * minMult);
    const maxBound = Math.round(basePrice * maxMult);
    rangePriceEl.textContent = `₹${minBound.toLocaleString('en-IN')} – ₹${maxBound.toLocaleString('en-IN')}`;
  }

  // 2. Factors Grid
  // Occupancy
  const occValEl = document.getElementById('factor-occupancy-val');
  const occBadgeEl = document.getElementById('factor-occupancy-badge');
  if (occValEl) occValEl.textContent = `${occupancy}%`;
  if (occBadgeEl) {
    const occAdj = multipliers.occupancyAdjustment || 0;
    const occPct = Math.round(occAdj * 100);
    occBadgeEl.textContent = `${occPct >= 0 ? '+' : ''}${occPct}%`;
    occBadgeEl.className = `badge ${occPct > 0 ? 'badge-success' : (occPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Demand
  const demValEl = document.getElementById('factor-demand-val');
  const demBadgeEl = document.getElementById('factor-demand-badge');
  if (demValEl) {
    const tier = demand >= 70 ? 'High' : (demand >= 40 ? 'Moderate' : 'Low');
    demValEl.textContent = `${tier} (${demand}/100)`;
  }
  if (demBadgeEl) {
    demBadgeEl.textContent = bookingCount === 1 ? '1 Confirmed' : `${bookingCount} Confirmed`;
    demBadgeEl.className = `badge ${bookingCount > 0 ? 'badge-primary' : 'badge-neutral'}`;
  }

  // Lead Time (Factor 3)
  const seasonValEl = document.getElementById('factor-season-val');
  const seasonBadgeEl = document.getElementById('factor-season-badge');
  if (seasonValEl) seasonValEl.textContent = `${leadTime} Days Advance`;
  if (seasonBadgeEl) {
    const leadAdj = multipliers.leadTimeAdjustment || 0;
    const leadPct = Math.round(leadAdj * 100);
    seasonBadgeEl.textContent = `${leadPct >= 0 ? '+' : ''}${leadPct}%`;
    seasonBadgeEl.className = `badge ${leadPct > 0 ? 'badge-success' : (leadPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Stay Duration (Factor 4)
  const dayValEl = document.getElementById('factor-day-val');
  const dayBadgeEl = document.getElementById('factor-day-badge');
  if (dayValEl) dayValEl.textContent = `${duration} Nights Stay`;
  if (dayBadgeEl) {
    const durAdj = multipliers.durationAdjustment || 0;
    const durPct = Math.round(durAdj * 100);
    dayBadgeEl.textContent = `${durPct >= 0 ? '+' : ''}${durPct}%`;
    dayBadgeEl.className = `badge ${durPct > 0 ? 'badge-success' : (durPct < 0 ? 'badge-warning' : 'badge-neutral')}`;
  }

  // Net Multiplier (Factor 5)
  const amenityBadgeEl = document.getElementById('factor-amenity-badge');
  if (amenityBadgeEl) {
    const clamped = multipliers.clampedMultiplier || 1.0;
    amenityBadgeEl.textContent = `${clamped}x Multiplier`;
    amenityBadgeEl.className = 'badge badge-primary';
  }

  // 3. Recommended Price Card (Highlighted CTA)
  const recPriceEl = document.getElementById('recommended-price-display');
  if (recPriceEl) recPriceEl.textContent = `₹${suggestedPrice.toLocaleString('en-IN')}`;

  const recCurrentEl = document.getElementById('recommended-current-baseline');
  if (recCurrentEl) recCurrentEl.textContent = `Current Active Rate: ₹${currentPrice.toLocaleString('en-IN')} / night`;

  const changePillEl = document.getElementById('recommended-price-change');
  if (changePillEl) {
    const priceDiff = suggestedPrice - currentPrice;
    const isPositive = priceDiff >= 0;
    const sign = isPositive ? '+' : '';
    const pct = currentPrice > 0 ? Math.round((priceDiff / currentPrice) * 1000) / 10 : 0;
    changePillEl.textContent = `${sign}₹${Math.abs(priceDiff).toLocaleString('en-IN')} (${sign}${pct}%) vs Active Rate`;
    changePillEl.style.color = isPositive ? 'var(--primary-dark)' : 'var(--danger)';
    changePillEl.style.fontWeight = '700';
  }

  // Algorithm Rationale Text
  const explanationEl = document.getElementById('pricing-explanation-text');
  if (explanationEl) {
    const bullets = Array.isArray(quote.explanations) && quote.explanations.length > 0
      ? quote.explanations.map(e => `• ${e}`).join('\n')
      : '• Market conditions balanced; standard anchor pricing recommended.';
    
    explanationEl.innerText = `${bullets}\n\n📌 Notice: This suggested rate is an algorithmic recommendation calculated from your base anchor (₹${basePrice.toLocaleString('en-IN')}). It is only applied to your active listing when you explicitly click Approve.`;
  }

  // Action Buttons
  const approveBtn = document.getElementById('btn-approve-price');
  const declineBtn = document.getElementById('btn-decline-price');
  if (approveBtn) {
    if (suggestedPrice === currentPrice) {
      approveBtn.textContent = '✓ Current Rate Matches Recommendation';
      approveBtn.disabled = true;
    } else {
      approveBtn.textContent = `Approve New Price (₹${suggestedPrice.toLocaleString('en-IN')} / night)`;
      approveBtn.disabled = false;
    }
  }

  if (declineBtn) {
    declineBtn.disabled = (suggestedPrice === currentPrice);
  }

  // 4. Transparent Breakdown Table
  renderBreakdownTable(quote);
}

/**
 * Render itemized calculation breakdown table
 * @param {Object} quote 
 */
function renderBreakdownTable(quote) {
  const tbody = document.getElementById('pricing-breakdown-tbody');
  if (!tbody) return;

  const basePrice = quote.basePrice || 0;
  const mult = quote.multipliers || {};
  const duration = quote.durationDays || 1;
  const leadTime = quote.leadTimeDays || 0;
  const suggestedPrice = quote.suggestedPricePerNight || quote.calculatedPrice || basePrice;
  const totalEstimated = quote.totalEstimatedPrice || (suggestedPrice * duration);

  const occPct = Math.round((mult.occupancyAdjustment || 0) * 100);
  const leadPct = Math.round((mult.leadTimeAdjustment || 0) * 100);
  const durPct = Math.round((mult.durationAdjustment || 0) * 100);

  const rows = [
    { factor: 'Base Reference Rate', formula: 'Property original base price (anchor)', impact: `₹${basePrice.toLocaleString('en-IN')}`, isBold: true },
    { factor: 'Occupancy Surge/Discount', formula: `Local occupancy calculated at ${quote.occupancyRate}%`, impact: `${occPct >= 0 ? '+' : ''}${occPct}%` },
    { factor: 'Advance Lead Time Adjustment', formula: `${leadTime} days advance reservation window`, impact: `${leadPct >= 0 ? '+' : ''}${leadPct}%` },
    { factor: 'Length-of-Stay Adjustment', formula: `${duration} nights stay duration`, impact: `${durPct >= 0 ? '+' : ''}${durPct}%` },
    { factor: 'Clamped Compound Multiplier', formula: `Bounded within safety limits [${mult.minAllowedMultiplier || 0.7}x, ${mult.maxAllowedMultiplier || 1.6}x]`, impact: `${mult.clampedMultiplier || 1.0}x` },
    { factor: 'Suggested Nightly Price', formula: 'Base Rate × Multiplier (rounded to ₹50)', impact: `₹${suggestedPrice.toLocaleString('en-IN')} / night`, isTotal: true },
    { factor: 'Total Estimated Stay Value', formula: `Suggested Nightly Rate × ${duration} nights`, impact: `₹${totalEstimated.toLocaleString('en-IN')}`, isBold: true }
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
 * Handle Owner Approval of the Recommended Price (Explicit manual action only)
 */
async function handleApprovePrice() {
  if (!activeOwner) {
    showPricingToast('Please log in as an owner to approve pricing updates.', 'warning');
    return;
  }

  // 1. Ensure the button uses the currently selected property's actual ID
  const selectEl = document.getElementById('pricing-property-select');
  const propertyId = (selectEl && selectEl.value) 
    ? String(selectEl.value).trim() 
    : (currentSelectedProperty ? String(currentSelectedProperty._id || currentSelectedProperty.id).trim() : '');

  if (!propertyId) {
    showPricingToast('Please select a valid property first.', 'warning');
    return;
  }

  if (!currentPricingQuote) {
    showPricingToast('No pricing recommendation available to approve.', 'warning');
    return;
  }

  // 2. Validate that the suggested price is a finite positive number
  const rawPrice = currentPricingQuote.suggestedPricePerNight || currentPricingQuote.calculatedPrice;
  const newPrice = Number(rawPrice);

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    showPricingToast('Invalid suggested price. Please recalculate dynamic pricing.', 'warning');
    return;
  }

  const currentApproved = currentSelectedProperty 
    ? Number(currentSelectedProperty.currentPrice ?? currentSelectedProperty.pricePerNight ?? currentPricingQuote.currentPrice) 
    : Number(currentPricingQuote.currentPrice ?? currentPricingQuote.basePrice);

  if (currentApproved === newPrice) {
    showPricingToast('Current approved price already matches the recommended price.', 'warning');
    return;
  }

  // 3. Disable the approval button while the request is in progress to prevent duplicate submissions
  const approveBtn = document.getElementById('btn-approve-price');
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.textContent = 'Approving Price on Server...';
  }

  try {
    // 4. Call ApiClient.approvePrice() to save the approved price to MongoDB without overwriting basePrice
    const quoteId = currentPricingQuote.quoteId || null;
    await window.ApiClient.approvePrice(propertyId, newPrice, quoteId);

    // 5. Fetch the property again from server to confirm persisted price and base price preservation
    const verifiedProperty = await window.ApiClient.getPropertyById(propertyId);
    if (!verifiedProperty) {
      throw new Error('Could not retrieve updated property from server for verification.');
    }

    const savedCurrentPrice = verifiedProperty.currentPrice ?? verifiedProperty.pricePerNight;
    if (savedCurrentPrice !== newPrice) {
      throw new Error(`Server verification mismatch: saved current price is ₹${savedCurrentPrice}, expected ₹${newPrice}.`);
    }

    // 6. Update selected property and in-memory properties list with verified server data
    currentSelectedProperty = verifiedProperty;
    const pIndex = ownerProperties.findIndex(p => String(p._id || p.id) === propertyId);
    if (pIndex !== -1) {
      ownerProperties[pIndex] = verifiedProperty;
    }

    // Synchronize localStorage if StorageUtils is active
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getProperties === 'function') {
      try {
        const localProps = StorageUtils.getProperties();
        const lIndex = localProps.findIndex(p => String(p._id || p.id) === propertyId);
        if (lIndex !== -1) {
          localProps[lIndex].currentPrice = newPrice;
          localProps[lIndex].pricePerNight = newPrice;
          if (verifiedProperty.basePrice !== undefined) {
            localProps[lIndex].basePrice = verifiedProperty.basePrice;
          }
          StorageUtils.saveProperties(localProps);
        }
      } catch (e) {
        console.warn('Could not mirror price update to localStorage:', e);
      }
    }

    // 7. Display success toast notification ONLY after server confirmation
    const propTitle = verifiedProperty.title || verifiedProperty.name || 'Property';
    const preservedBase = verifiedProperty.basePrice ?? currentPricingQuote.basePrice;
    showPricingToast(`Approved rate of ₹${newPrice.toLocaleString('en-IN')} / night for "${propTitle}" saved to MongoDB! (Base rate preserved: ₹${preservedBase.toLocaleString('en-IN')})`, 'success');

    // 8. Refresh pricing display: update Current Price, keep Base Price untouched!
    const currentPriceEl = document.getElementById('current-price-val');
    if (currentPriceEl) currentPriceEl.textContent = `₹${newPrice.toLocaleString('en-IN')}`;

    const basePriceEl = document.getElementById('base-price-val');
    if (basePriceEl) basePriceEl.textContent = `₹${preservedBase.toLocaleString('en-IN')}`;

    const recBaselineEl = document.getElementById('recommended-current-baseline');
    if (recBaselineEl) recBaselineEl.textContent = `Current Active Rate: ₹${newPrice.toLocaleString('en-IN')} / night (Approved)`;

    if (approveBtn) {
      approveBtn.textContent = `✓ Current Rate Matches Recommendation`;
      approveBtn.disabled = true;
    }

    // Refresh quote so explanations and recommendation compare against the newly approved current rate
    setTimeout(async () => {
      try {
        await recalculatePricing();
      } catch (recalcErr) {
        console.warn('[PricingPage] Error recalculating quote after approval:', recalcErr);
      }
    }, 1500);

  } catch (err) {
    console.error('[PricingPage] Failed to approve property price:', err);
    showPricingToast(err.message || 'Failed to approve price on the server.', 'error');
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.textContent = `Approve New Price (₹${newPrice.toLocaleString('en-IN')} / night)`;
    }
  }
}

/**
 * Handle Owner Declining or Dismissing the Recommendation
 */
function handleDeclinePrice() {
  if (!currentSelectedProperty) return;
  const currentRate = currentSelectedProperty.pricePerNight || 0;
  const propTitle = currentSelectedProperty.title || currentSelectedProperty.name || 'Property';
  showPricingToast(`Recommendation dismissed. Current rate of ₹${currentRate.toLocaleString('en-IN')} / night maintained for "${propTitle}".`, 'info');
}

/**
 * Display toast notification matching owner dashboard styling
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} [type] 
 */
function showPricingToast(message, type = 'success') {
  if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
    Toast.show(message, type);
    return;
  }

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

// Support CommonJS export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPricingPage,
    setupDefaultDates,
    populateOwnerProperties,
    bindPricingListeners,
    recalculatePricing,
    renderPricingCockpit,
    renderBreakdownTable,
    handleApprovePrice,
    handleDeclinePrice,
    showPricingToast
  };
}
