/**
 * DynamicRent - Owner Module: Analytics Calculation Engine & Controller (js/owner/analytics.js)
 * Step 9: Transforms stored project data into real-time metrics, KPI benchmarks,
 * property performance tiers, and dynamic pricing insights.
 */

let activeOwner = null;
let selectedPropertyFilter = 'all';
let selectedDateRangeFilter = '30d';

const AnalyticsEngine = {
  /**
   * Filter bookings array by date range based on booking createdAt or checkIn date
   * @param {Array} bookings 
   * @param {string} dateRange '7d' | '30d' | '90d' | 'thisYear' | 'allTime'
   * @returns {Array} Filtered bookings
   */
  filterBookingsByDateRange(bookings, dateRange) {
    if (!Array.isArray(bookings)) return [];
    if (dateRange === 'allTime') return bookings;

    const now = Date.now();
    let cutoffTimestamp = 0;

    if (dateRange === '7d') {
      cutoffTimestamp = now - (7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      cutoffTimestamp = now - (30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '90d') {
      cutoffTimestamp = now - (90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'thisYear') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      cutoffTimestamp = startOfYear.getTime();
    }

    return bookings.filter(b => {
      // Use createdAt timestamp or parse checkIn date
      let bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (!bTime && b.checkIn) {
        bTime = new Date(b.checkIn).getTime();
      }
      return bTime >= cutoffTimestamp;
    });
  },

  /**
   * Calculate total revenue from confirmed bookings only
   * @param {Array} bookings 
   * @returns {number}
   */
  calculateRevenue(bookings) {
    if (!Array.isArray(bookings)) return 0;
    const confirmed = bookings.filter(b => (b.status || '').toLowerCase() === 'confirmed');
    return confirmed.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  },

  /**
   * Calculate status counts for bookings (confirmed, pending, rejected)
   * @param {Array} bookings 
   * @returns {{ total: number, confirmed: number, pending: number, rejected: number }}
   */
  calculateBookingStats(bookings) {
    if (!Array.isArray(bookings)) return { total: 0, confirmed: 0, pending: 0, rejected: 0 };

    let confirmed = 0;
    let pending = 0;
    let rejected = 0;

    bookings.forEach(b => {
      const st = (b.status || 'pending').toLowerCase();
      if (st === 'confirmed') confirmed++;
      else if (st === 'rejected') rejected++;
      else pending++;
    });

    return {
      total: bookings.length,
      confirmed,
      pending,
      rejected
    };
  },

  /**
   * Calculate average booking value from confirmed revenue and confirmed bookings count
   * @param {number} totalRevenue 
   * @param {number} confirmedCount 
   * @returns {number}
   */
  calculateAverageBookingValue(totalRevenue, confirmedCount) {
    if (!confirmedCount || confirmedCount <= 0 || !totalRevenue || totalRevenue <= 0) {
      return 0;
    }
    return Math.round(totalRevenue / confirmedCount);
  },

  /**
   * Calculate property performance list with classification badges
   * @param {Array} properties 
   * @param {Array} bookings 
   * @returns {Array}
   */
  calculatePropertyPerformance(properties, bookings) {
    if (!Array.isArray(properties)) return [];

    return properties.map(prop => {
      const propBookings = bookings.filter(b => b.propertyId === prop.id);
      const confirmedBookings = propBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed');
      const revenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

      // Occupancy
      const occStats = (typeof OccupancyEngine !== 'undefined')
        ? OccupancyEngine.calculatePropertyOccupancy(prop.id)
        : { occupancyRate: 0, confirmedBookingsCount: confirmedBookings.length };

      // Demand
      const demandStats = (typeof DemandEngine !== 'undefined')
        ? DemandEngine.calculateDemandScore(prop.id)
        : { score: 50, level: 'Medium', badgeClass: 'demand-medium' };

      // Pricing
      const currentPrice = prop.currentPrice || prop.pricePerNight || 0;
      const basePrice = prop.basePrice || prop.pricePerNight || currentPrice;

      // Classification Logic:
      // Excellent >= 75%, Good >= 55%, Average >= 35%, Needs Attention < 35%
      let performanceTier = 'Needs Attention';
      let performanceBadgeClass = 'badge-danger';

      if (occStats.occupancyRate >= 75) {
        performanceTier = 'Excellent';
        performanceBadgeClass = 'badge-success';
      } else if (occStats.occupancyRate >= 55) {
        performanceTier = 'Good';
        performanceBadgeClass = 'badge-primary';
      } else if (occStats.occupancyRate >= 35) {
        performanceTier = 'Average';
        performanceBadgeClass = 'badge-warning';
      }

      return {
        id: prop.id,
        name: prop.name,
        location: prop.location,
        area: prop.area,
        bookingsCount: propBookings.length,
        confirmedCount: confirmedBookings.length,
        revenue,
        occupancy: occStats.occupancyRate,
        currentPrice,
        basePrice,
        demandLevel: demandStats.level,
        demandScore: demandStats.score,
        demandBadgeClass: demandStats.badgeClass,
        performanceTier,
        performanceBadgeClass
      };
    });
  },

  /**
   * Identify top revenue generator and lowest occupancy property
   * @param {Array} performanceList 
   * @returns {{ topEarner: Object|null, lowOccupancy: Object|null }}
   */
  getTopAndLowPerformingProperties(performanceList) {
    if (!Array.isArray(performanceList) || performanceList.length === 0) {
      return { topEarner: null, lowOccupancy: null };
    }

    const sortedByRevenue = [...performanceList].sort((a, b) => b.revenue - a.revenue);
    const sortedByOcc = [...performanceList].sort((a, b) => a.occupancy - b.occupancy);

    const topEarner = sortedByRevenue[0] || null;
    const lowOccupancy = sortedByOcc[0] || null;

    return { topEarner, lowOccupancy };
  },

  /**
   * Calculate pricing performance metrics and history audit summary
   * @param {Array} properties 
   * @param {string} ownerId 
   * @returns {Array}
   */
  calculatePriceStats(properties, ownerId) {
    if (!Array.isArray(properties)) return [];
    const allHistory = (typeof PriceHistoryManager !== 'undefined')
      ? PriceHistoryManager.getHistoryByOwner(ownerId)
      : [];

    return properties.map(prop => {
      const propHistory = allHistory.filter(h => h.propertyId === prop.id);
      const basePrice = prop.basePrice || prop.pricePerNight || 4000;
      const currentPrice = prop.currentPrice || prop.pricePerNight || basePrice;

      let highestPrice = currentPrice;
      let lowestPrice = currentPrice;

      if (propHistory.length > 0) {
        const prices = [basePrice, currentPrice, ...propHistory.map(h => h.newPrice || 0), ...propHistory.map(h => h.oldPrice || 0)];
        highestPrice = Math.max(...prices);
        lowestPrice = Math.min(...prices.filter(p => p > 0));
      }

      return {
        id: prop.id,
        name: prop.name,
        basePrice,
        currentPrice,
        changeCount: propHistory.length,
        highestPrice,
        lowestPrice,
        historyRecords: propHistory
      };
    });
  },

  /**
   * Build timeline revenue points for Revenue Trend chart
   * @param {Array} bookings 
   * @param {string} dateRange 
   * @returns {Array<{ label: string, revenue: number }>}
   */
  buildRevenueTimeline(bookings, dateRange) {
    const confirmed = (bookings || []).filter(b => (b.status || '').toLowerCase() === 'confirmed');
    const dayMap = {};

    // Generate buckets based on range
    const daysToLook = dateRange === '7d' ? 7 : (dateRange === '30d' ? 30 : (dateRange === '90d' ? 90 : 30));
    const now = new Date();

    for (let i = daysToLook - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      dayMap[key] = 0;
    }

    confirmed.forEach(b => {
      const d = b.createdAt ? new Date(b.createdAt) : (b.checkIn ? new Date(b.checkIn) : new Date());
      const key = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      if (dayMap[key] !== undefined) {
        dayMap[key] += (b.totalPrice || 0);
      }
    });

    return Object.entries(dayMap).map(([label, revenue]) => ({ label, revenue }));
  },

  /**
   * Build timeline points for Price Trend line chart
   * @param {string} propertyId 
   * @param {string} ownerId 
   * @param {Array} properties 
   * @returns {Array<{ dateStr: string, price: number }>}
   */
  buildPriceTimeline(propertyId, ownerId, properties) {
    const allHistory = (typeof PriceHistoryManager !== 'undefined')
      ? PriceHistoryManager.getHistoryByOwner(ownerId)
      : [];

    let filteredHistory = allHistory;
    let defaultBase = 4500;

    if (propertyId && propertyId !== 'all') {
      filteredHistory = allHistory.filter(h => h.propertyId === propertyId);
      const prop = properties.find(p => p.id === propertyId);
      if (prop) defaultBase = prop.basePrice || prop.pricePerNight || 4500;
    }

    if (filteredHistory.length === 0) {
      return [
        { dateStr: 'Initial Base', price: defaultBase },
        { dateStr: 'Current Rate', price: defaultBase }
      ];
    }

    // Sort chronologically ascending
    const sorted = [...filteredHistory].sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0));

    const timeline = [];
    // Starting anchor
    const first = sorted[0];
    timeline.push({
      dateStr: 'Base Anchor',
      price: first.oldPrice || defaultBase
    });

    sorted.forEach(h => {
      const d = h.changedAt ? new Date(h.changedAt) : new Date();
      const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      timeline.push({
        dateStr: label,
        price: h.newPrice || defaultBase
      });
    });

    return timeline;
  },

  /**
   * Synthesize real data pricing insights
   * @param {Object} summary 
   * @returns {Array<string>}
   */
  generateInsights(summary) {
    const insights = [];

    if (summary.topEarner && summary.topEarner.revenue > 0) {
      insights.push(`<strong>${summary.topEarner.name}</strong> is your top performer, generating ₹${summary.topEarner.revenue.toLocaleString('en-IN')} in confirmed revenue with ${summary.topEarner.occupancy}% occupancy.`);
    }

    if (summary.lowOccupancy && summary.lowOccupancy.occupancy < 35) {
      insights.push(`<strong>${summary.lowOccupancy.name}</strong> has lower occupancy (${summary.lowOccupancy.occupancy}%) with ${summary.lowOccupancy.demandLevel} demand. Consider tuning rates via the Dynamic Pricing Engine.`);
    }

    if (summary.averageBookingValue > 0) {
      insights.push(`Portfolio Average Booking Value is <strong>₹${summary.averageBookingValue.toLocaleString('en-IN')}</strong> across ${summary.bookingStats.confirmed} confirmed stays.`);
    }

    if (summary.priceStats && summary.priceStats.some(p => p.changeCount > 0)) {
      const tunedProps = summary.priceStats.filter(p => p.changeCount > 0).length;
      insights.push(`You have active rate optimizations applied across <strong>${tunedProps} listings</strong>, keeping rates aligned with current market demand.`);
    }

    if (insights.length === 0) {
      insights.push('Analytics and algorithmic insights will deepen as more customers book your listings.');
    }

    return insights;
  }
};

// ==========================================================================
// Master Page UI Controller
// ==========================================================================

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initAnalyticsDashboard();
  });
}

/**
 * Initialize Analytics Dashboard View
 */
function initAnalyticsDashboard() {
  try {
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();
    if (typeof initDefaultBookings === 'function') initDefaultBookings();

    activeOwner = StorageUtils.getCurrentUser();
    if (!activeOwner || activeOwner.role !== 'owner') {
      redirectToLogin();
      return;
    }

    // 1. Update Header profile
    updateHeaderProfile(activeOwner);

    // 2. Populate Property Selector
    populateAnalyticsPropertySelector(activeOwner.id);

    // 3. Bind Filter Listeners
    bindAnalyticsListeners();

    // 4. Initial Render
    refreshAnalytics();

  } catch (err) {
    console.error('Error initializing analytics dashboard:', err);
  }
}

/**
 * Update Header Profile
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
 * Populate Property Dropdown
 * @param {string} ownerId 
 */
function populateAnalyticsPropertySelector(ownerId) {
  const selectEl = document.getElementById('analytics-property-select');
  if (!selectEl) return;

  const properties = StorageUtils.getOwnerProperties(ownerId);
  selectEl.innerHTML = '<option value="all" selected>All Properties (Portfolio Wide)</option>';

  properties.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.location})`;
    selectEl.appendChild(opt);
  });
}

/**
 * Bind Property and Date Range filter listeners
 */
function bindAnalyticsListeners() {
  const propSelect = document.getElementById('analytics-property-select');
  const dateSelect = document.getElementById('analytics-date-range');

  if (propSelect) {
    propSelect.addEventListener('change', (e) => {
      selectedPropertyFilter = e.target.value;
      refreshAnalytics();
    });
  }

  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      selectedDateRangeFilter = e.target.value;
      refreshAnalytics();
    });
  }
}

/**
 * Refresh and render entire Analytics Dashboard based on active filters
 */
function refreshAnalytics() {
  if (!activeOwner) return;

  // 1. Query raw owner data
  const allProperties = StorageUtils.getOwnerProperties(activeOwner.id);
  const rawBookings = StorageUtils.getOwnerBookings(activeOwner.id);

  // 2. Filter properties if single property selected
  const activeProperties = (selectedPropertyFilter === 'all')
    ? allProperties
    : allProperties.filter(p => p.id === selectedPropertyFilter);

  // 3. Filter bookings by property and date range
  let scopedBookings = (selectedPropertyFilter === 'all')
    ? rawBookings
    : rawBookings.filter(b => b.propertyId === selectedPropertyFilter);

  const filteredBookings = AnalyticsEngine.filterBookingsByDateRange(scopedBookings, selectedDateRangeFilter);

  // 4. Calculate Core KPIs
  const totalRevenue = AnalyticsEngine.calculateRevenue(filteredBookings);
  const bookingStats = AnalyticsEngine.calculateBookingStats(filteredBookings);
  const avgBookingVal = AnalyticsEngine.calculateAverageBookingValue(totalRevenue, bookingStats.confirmed);

  // Portfolio / Property Occupancy
  let occupancyRate = 0;
  if (selectedPropertyFilter === 'all') {
    occupancyRate = (typeof OccupancyEngine !== 'undefined')
      ? OccupancyEngine.calculateOverallOwnerOccupancy(activeOwner.id).overallOccupancyRate
      : 0;
  } else {
    occupancyRate = (typeof OccupancyEngine !== 'undefined')
      ? OccupancyEngine.calculatePropertyOccupancy(selectedPropertyFilter).occupancyRate
      : 0;
  }

  // 5. Update KPI Cards DOM
  const revEl = document.getElementById('stat-total-revenue');
  const confEl = document.getElementById('stat-confirmed-bookings');
  const occEl = document.getElementById('stat-occupancy-rate');
  const avgValEl = document.getElementById('stat-avg-booking-value');

  if (revEl) revEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
  if (confEl) confEl.textContent = bookingStats.confirmed.toString();
  if (occEl) occEl.textContent = `${occupancyRate}%`;
  if (avgValEl) avgValEl.textContent = `₹${avgBookingVal.toLocaleString('en-IN')}`;

  // 6. Property Performance Calculations
  const performanceList = AnalyticsEngine.calculatePropertyPerformance(allProperties, rawBookings);
  const { topEarner, lowOccupancy } = AnalyticsEngine.getTopAndLowPerformingProperties(performanceList);

  // 7. Update Spotlight Cards
  renderSpotlightCards(topEarner, lowOccupancy);

  // 8. Render Property Performance Table
  renderPerformanceTable(performanceList);

  // 9. Render Pricing Performance Section
  const priceStats = AnalyticsEngine.calculatePriceStats(allProperties, activeOwner.id);
  renderPricingPerformanceTable(priceStats);

  // 10. Generate and Render Dynamic Insights
  const insights = AnalyticsEngine.generateInsights({
    topEarner,
    lowOccupancy,
    averageBookingValue: avgBookingVal,
    bookingStats,
    priceStats
  });
  renderInsightsBox(insights);

  // 11. Render Interactive Chart.js Visualizers (if module available)
  if (typeof AnalyticsCharts !== 'undefined') {
    // Chart 1: Revenue Trend
    const revTimeline = AnalyticsEngine.buildRevenueTimeline(scopedBookings, selectedDateRangeFilter);
    AnalyticsCharts.renderRevenueTrendChart('chart-revenue-trend', revTimeline);

    // Chart 2: Booking Status Overview
    AnalyticsCharts.renderBookingOverviewChart('chart-booking-overview', bookingStats);

    // Chart 3: Occupancy by Property
    const occList = allProperties.map(p => ({
      name: p.name,
      occupancy: (typeof OccupancyEngine !== 'undefined') ? OccupancyEngine.calculatePropertyOccupancy(p.id).occupancyRate : 0
    }));
    AnalyticsCharts.renderOccupancyChart('chart-occupancy-bars', occList);

    // Chart 4: Revenue by Property
    const revList = allProperties.map(p => {
      const pConf = rawBookings.filter(b => b.propertyId === p.id && (b.status || '').toLowerCase() === 'confirmed');
      return {
        name: p.name,
        revenue: pConf.reduce((sum, b) => sum + (b.totalPrice || 0), 0)
      };
    });
    AnalyticsCharts.renderRevenueByPropertyChart('chart-revenue-property', revList);

    // Chart 5: Price Trend
    const priceTimeline = AnalyticsEngine.buildPriceTimeline(selectedPropertyFilter, activeOwner.id, allProperties);
    AnalyticsCharts.renderPriceTrendChart('chart-price-trend', priceTimeline);
  }
}

/**
 * Render Spotlight cards for Top Earner and Needs Attention
 * @param {Object} topEarner 
 * @param {Object} lowOccupancy 
 */
function renderSpotlightCards(topEarner, lowOccupancy) {
  const topCard = document.getElementById('spotlight-top-property');
  const lowCard = document.getElementById('spotlight-low-property');

  if (topCard) {
    if (topEarner && topEarner.revenue > 0) {
      topCard.innerHTML = `
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--primary-dark); margin-bottom: 2px;">
          ★ Top Performing Listing
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">
          ${topEarner.name}
        </div>
        <div style="display: flex; gap: 14px; font-size: 0.82rem; color: var(--text-secondary);">
          <span>Revenue: <strong style="color: var(--primary-dark);">₹${topEarner.revenue.toLocaleString('en-IN')}</strong></span>
          <span>Occupancy: <strong style="color: var(--text-primary);">${topEarner.occupancy}%</strong></span>
          <span>Confirmed: <strong style="color: var(--text-primary);">${topEarner.confirmedCount}</strong></span>
        </div>
      `;
    } else {
      topCard.innerHTML = `
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
          ★ Top Performing Listing
        </div>
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 4px;">
          Awaiting confirmed bookings
        </div>
      `;
    }
  }

  if (lowCard) {
    if (lowOccupancy) {
      lowCard.innerHTML = `
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #b45309; margin-bottom: 2px;">
          ⚠ Property Needing Attention
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">
          ${lowOccupancy.name}
        </div>
        <div style="display: flex; gap: 14px; font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">
          <span>Occupancy: <strong style="color: #b45309;">${lowOccupancy.occupancy}%</strong></span>
          <span>Demand: <strong style="color: var(--text-primary);">${lowOccupancy.demandLevel}</strong></span>
          <span>Rate: <strong style="color: var(--text-primary);">₹${lowOccupancy.currentPrice.toLocaleString('en-IN')}</strong></span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-secondary);">
          💡 Suggestion: Consider reviewing price in <a href="pricing.html?id=${lowOccupancy.id}" style="color: var(--primary-dark); font-weight: 700; text-decoration: underline;">Dynamic Pricing</a> to stimulate demand.
        </div>
      `;
    } else {
      lowCard.innerHTML = `
        <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
          ⚠ Property Needing Attention
        </div>
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 4px;">
          Portfolio metrics balanced
        </div>
      `;
    }
  }
}

/**
 * Render Property Performance Table
 * @param {Array} performanceList 
 */
function renderPerformanceTable(performanceList) {
  const tbody = document.getElementById('performance-table-tbody');
  if (!tbody) return;

  if (performanceList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">No properties found.</td></tr>';
    return;
  }

  tbody.innerHTML = performanceList.map(p => {
    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${p.location} &bull; ${p.id}</div>
        </td>
        <td style="font-weight: 600;">
          ${p.confirmedCount} <span style="color: var(--text-muted); font-size: 0.76rem;">(${p.bookingsCount} total)</span>
        </td>
        <td style="font-weight: 800; color: var(--primary-dark);">
          ₹${p.revenue.toLocaleString('en-IN')}
        </td>
        <td style="font-weight: 700;">
          ${p.occupancy}%
        </td>
        <td style="font-weight: 700; color: var(--text-primary);">
          ₹${p.currentPrice.toLocaleString('en-IN')}
        </td>
        <td>
          <span class="demand-badge ${p.demandBadgeClass}">${p.demandLevel} &bull; ${p.demandScore}</span>
        </td>
        <td>
          <span class="badge ${p.performanceBadgeClass}">${p.performanceTier}</span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render Pricing Performance Table
 * @param {Array} priceStats 
 */
function renderPricingPerformanceTable(priceStats) {
  const tbody = document.getElementById('pricing-performance-tbody');
  if (!tbody) return;

  if (priceStats.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">No pricing history found.</td></tr>';
    return;
  }

  tbody.innerHTML = priceStats.map(p => {
    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${p.id}</div>
        </td>
        <td style="color: var(--text-secondary); font-weight: 600;">
          ₹${p.basePrice.toLocaleString('en-IN')}
        </td>
        <td style="font-weight: 800; color: var(--primary-dark);">
          ₹${p.currentPrice.toLocaleString('en-IN')}
        </td>
        <td>
          <span class="badge badge-neutral">${p.changeCount} approved updates</span>
        </td>
        <td style="font-weight: 700; color: var(--text-primary);">
          ₹${p.highestPrice.toLocaleString('en-IN')}
        </td>
        <td style="font-weight: 700; color: var(--text-secondary);">
          ₹${p.lowestPrice.toLocaleString('en-IN')}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render dynamic insights list
 * @param {Array<string>} insights 
 */
function renderInsightsBox(insights) {
  const container = document.getElementById('analytics-insights-list');
  if (!container) return;

  container.innerHTML = insights.map(text => {
    return `
      <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border-light); font-size: 0.88rem; line-height: 1.45;">
        <span style="color: var(--primary); font-size: 1.1rem; flex-shrink: 0; line-height: 1;">💡</span>
        <div>${text}</div>
      </div>
    `;
  }).join('');
}
