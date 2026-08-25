/**
 * DynamicRent - Owner Module: Dashboard Controller (js/owner/ownerDashboard.js)
 * Step 7: Computes live portfolio KPIs, integrates Occupancy & Demand Engines,
 * updates header & occupancy widgets, renders recent bookings table, and property performance cards.
 */

document.addEventListener('DOMContentLoaded', () => {
  initOwnerDashboard();
});

/**
 * Initialize Owner Dashboard metrics, recent requests table, and property performance grid
 */
function initOwnerDashboard() {
  try {
    // 1. Ensure default datasets are seeded
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();
    if (typeof initDefaultBookings === 'function') initDefaultBookings();

    // 2. Fetch authenticated owner
    const currentOwner = StorageUtils.getCurrentUser();
    if (!currentOwner || currentOwner.role !== 'owner') {
      console.warn('Owner session missing. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
      } else {
        window.location.href = '../login.html';
      }
      return;
    }

    // 3. Update header profile & welcome subtitle
    updateHeaderProfile(currentOwner);

    // 4. Query properties and bookings for this owner
    const ownerProperties = StorageUtils.getOwnerProperties(currentOwner.id);
    const ownerBookings = StorageUtils.getOwnerBookings(currentOwner.id);

    // 5. Calculate dynamic statistics
    const totalProperties = ownerProperties.length;
    const totalRequests = ownerBookings.length;
    const pendingRequests = ownerBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;
    const confirmedBookings = ownerBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').length;

    // Revenue Rule: Only confirmed bookings contribute to revenue
    const totalRevenue = ownerBookings
      .filter(b => (b.status || '').toLowerCase() === 'confirmed')
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Overall Occupancy Rule: Computed via OccupancyEngine across all owner properties
    const occupancyStats = (typeof OccupancyEngine !== 'undefined')
      ? OccupancyEngine.calculateOverallOwnerOccupancy(currentOwner.id)
      : { overallOccupancyRate: 0, totalOccupiedNights: 0, totalAvailableNights: 0, monthName: 'Current Month', year: 2026 };

    // 6. Update KPI card values in DOM
    const totalPropEl = document.getElementById('kpi-total-properties');
    if (totalPropEl) totalPropEl.textContent = totalProperties.toString();

    const totalReqEl = document.getElementById('kpi-total-requests');
    if (totalReqEl) totalReqEl.textContent = totalRequests.toString();

    const pendingSubEl = document.getElementById('kpi-pending-subtext');
    if (pendingSubEl) pendingSubEl.textContent = `${pendingRequests} pending review`;

    const confirmedEl = document.getElementById('kpi-confirmed-bookings');
    if (confirmedEl) confirmedEl.textContent = confirmedBookings.toString();

    const revenueEl = document.getElementById('kpi-total-revenue');
    if (revenueEl) revenueEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

    const occupancyEl = document.getElementById('kpi-overall-occupancy');
    if (occupancyEl) occupancyEl.textContent = `${occupancyStats.overallOccupancyRate}%`;

    const occSubtextEl = document.getElementById('kpi-occupancy-subtext');
    if (occSubtextEl) occSubtextEl.textContent = `${occupancyStats.monthName || 'Month'} ${occupancyStats.year || ''} portfolio`;

    // 7. Update Occupancy Overview Widget
    updateOccupancyOverviewWidget(occupancyStats, confirmedBookings, totalProperties);

    // 8. Render Recent Booking Requests Table
    renderRecentBookingsTable(ownerBookings);

    // 9. Render Property Performance Cards
    renderPropertyPerformanceCards(ownerProperties);

    console.log(`Owner Dashboard initialized for ${currentOwner.name}: ${totalProperties} listings, ${totalRequests} bookings, ${occupancyStats.overallOccupancyRate}% overall occupancy.`);
  } catch (err) {
    console.error('Error initializing owner dashboard:', err);
  }
}

/**
 * Update top header profile name, welcome subtitle, and avatar initials
 * @param {Object} owner 
 */
function updateHeaderProfile(owner) {
  const nameEl = document.getElementById('owner-name-display');
  if (nameEl) nameEl.textContent = owner.name || 'Owner';

  const welcomeEl = document.getElementById('owner-welcome-text');
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome back, ${owner.name || 'Owner'} — Real-time occupancy tracking, market demand scoring, and revenue performance.`;
  }

  const avatarEl = document.getElementById('owner-avatar');
  if (avatarEl && owner.name) {
    const initials = owner.name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    avatarEl.textContent = initials || 'O';
  }
}

/**
 * Update the Occupancy Overview Widget UI
 * @param {Object} occStats 
 * @param {number} confirmedCount 
 * @param {number} propertyCount 
 */
function updateOccupancyOverviewWidget(occStats, confirmedCount, propertyCount) {
  const titleEl = document.getElementById('occupancy-card-title');
  if (titleEl && occStats.monthName) {
    titleEl.textContent = `${occStats.monthName} ${occStats.year || ''} Portfolio Occupancy`;
  }

  const headlineRateEl = document.getElementById('occupancy-headline-rate');
  if (headlineRateEl) {
    headlineRateEl.textContent = `${occStats.overallOccupancyRate}%`;
  }

  const progressBarEl = document.getElementById('occupancy-progress-bar');
  if (progressBarEl) {
    progressBarEl.style.width = `${Math.min(100, occStats.overallOccupancyRate)}%`;
  }

  const occupiedNightsEl = document.getElementById('occ-occupied-nights');
  if (occupiedNightsEl) {
    occupiedNightsEl.textContent = `${occStats.totalOccupiedNights || 0} Nights`;
  }

  const totalNightsEl = document.getElementById('occ-total-nights');
  if (totalNightsEl) {
    totalNightsEl.textContent = `${occStats.totalAvailableNights || 0} Nights`;
  }

  const confirmedCountEl = document.getElementById('occ-confirmed-count');
  if (confirmedCountEl) {
    confirmedCountEl.textContent = `${confirmedCount} Stays`;
  }

  const propCountEl = document.getElementById('occ-properties-count');
  if (propCountEl) {
    propCountEl.textContent = `${propertyCount} Listings`;
  }
}

/**
 * Render Recent Booking Requests into a clean SaaS data table
 * @param {Array} bookings 
 */
function renderRecentBookingsTable(bookings) {
  const tbody = document.getElementById('dashboard-recent-tbody');
  if (!tbody) return;

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px 20px; color: var(--text-secondary);">
          <div style="font-size: 1.6rem; margin-bottom: 6px;">📬</div>
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">No booking requests yet.</div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">When guests submit reservation requests, they will appear in this table.</div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort newest first, top 5 records
  const sorted = [...bookings].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const recent5 = sorted.slice(0, 5);

  tbody.innerHTML = recent5.map(b => {
    const checkInFormatted = (typeof DateUtils !== 'undefined') ? DateUtils.formatDate(b.checkIn) : b.checkIn;
    const checkOutFormatted = (typeof DateUtils !== 'undefined') ? DateUtils.formatDate(b.checkOut) : b.checkOut;
    const datesText = `${checkInFormatted} → ${checkOutFormatted}`;

    const status = (b.status || 'pending').toLowerCase();
    let badgeClass = 'badge-warning';
    let badgeText = 'Pending';

    if (status === 'confirmed') {
      badgeClass = 'badge-success';
      badgeText = 'Confirmed';
    } else if (status === 'rejected') {
      badgeClass = 'badge-danger';
      badgeText = 'Rejected';
    }

    const actionText = status === 'pending' ? 'Review' : 'View';

    return `
      <tr>
        <td>
          <div class="table-prop-title">${b.propertyName || 'Property'}</div>
          <div class="table-prop-id">${b.id} &bull; ${b.propertyLocation || 'India'}</div>
        </td>
        <td>
          <div class="table-cust-name">${b.customerName || 'Guest'}</div>
          <div class="table-cust-email">${b.customerEmail || ''}</div>
        </td>
        <td style="font-weight: 600; font-size: 0.84rem;">
          ${datesText}
        </td>
        <td>
          ${b.guests || 1} Guests <span style="color: var(--text-muted); font-size: 0.78rem;">(${b.nights || 1}N)</span>
        </td>
        <td style="font-weight: 800; color: var(--primary-dark); font-size: 0.92rem;">
          ₹${(b.totalPrice || 0).toLocaleString('en-IN')}
        </td>
        <td>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </td>
        <td style="text-align: right;">
          <a href="bookings.html" class="btn btn-outline btn-sm">${actionText}</a>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render Property Performance Cards with occupancy, confirmed bookings, and live market demand
 * @param {Array} properties 
 */
function renderPropertyPerformanceCards(properties) {
  const grid = document.getElementById('dashboard-performance-grid');
  if (!grid) return;

  if (!properties || properties.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No properties found.</h3>
        <p>You currently have no active listings registered in your portfolio.</p>
      </div>
    `;
    return;
  }

  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  grid.innerHTML = properties.map(prop => {
    // 1. Calculate Occupancy Stats via OccupancyEngine
    const occStats = (typeof OccupancyEngine !== 'undefined')
      ? OccupancyEngine.calculatePropertyOccupancy(prop.id)
      : { occupancyRate: 0, confirmedBookingsCount: 0 };

    // 2. Calculate Demand Stats via DemandEngine
    const demandStats = (typeof DemandEngine !== 'undefined')
      ? DemandEngine.calculateDemandScore(prop.id)
      : { score: 30, level: 'Low', badgeClass: 'demand-low' };

    const demandBadgeHtml = (typeof DemandEngine !== 'undefined')
      ? DemandEngine.getDemandBadgeHtml(demandStats.level, demandStats.score)
      : `<span class="demand-badge demand-low">Low &bull; ${demandStats.score}/100</span>`;

    // 3. Calculate Recommended Price via PricingEngine (Step 8)
    const pricingRec = (typeof PricingEngine !== 'undefined')
      ? PricingEngine.calculateDynamicPrice(prop.id)
      : { recommendedPrice: (prop.currentPrice || prop.pricePerNight || 0), priceChange: 0, priceChangePercent: 0 };

    const currentPriceFormatted = (prop.currentPrice || prop.pricePerNight || 0).toLocaleString('en-IN');
    const recPriceFormatted = (pricingRec.recommendedPrice || 0).toLocaleString('en-IN');
    const locationStr = prop.area ? `${prop.area}, ${prop.location}` : prop.location;

    return `
      <div class="performance-card">
        <div class="performance-media">
          <img 
            src="${prop.image || fallbackImg}" 
            alt="${prop.name}"
            onerror="this.onerror=null;this.src='${fallbackImg}';"
          >
          <span class="badge badge-primary performance-badge-left">${prop.type || 'Stay'}</span>
          <div class="performance-badge-right">
            ${demandBadgeHtml}
          </div>
        </div>

        <div class="performance-body">
          <div>
            <h3 class="performance-title">${prop.name}</h3>
            <div class="performance-location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${locationStr}, India</span>
            </div>
          </div>

          <div class="performance-stats-strip">
            <div class="perf-stat-item">
              <span class="perf-stat-label">Occupancy</span>
              <strong class="perf-stat-val" style="color: var(--primary-dark);">${occStats.occupancyRate}%</strong>
            </div>
            <div class="perf-stat-item">
              <span class="perf-stat-label">Confirmed</span>
              <strong class="perf-stat-val">${occStats.confirmedBookingsCount}</strong>
            </div>
            <div class="perf-stat-item">
              <span class="perf-stat-label">Demand Score</span>
              <strong class="perf-stat-val">${demandStats.score}/100</strong>
            </div>
          </div>

          <div class="performance-footer" style="align-items: flex-end;">
            <div>
              <div class="performance-price">
                ₹${currentPriceFormatted} <span>/ night</span>
              </div>
              <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 2px;">
                Recommended: <strong style="color: var(--primary-dark);">₹${recPriceFormatted}</strong>
              </div>
            </div>
            <a href="pricing.html?id=${prop.id}" class="btn btn-primary btn-sm">Optimize Price</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
