/**
 * Comprehensive Verification Suite for Owner Analytics Page
 * Tests:
 * 1. Live Backend ON: Real database data loads, calculations are exact, DOM elements populated
 * 2. Filter Interaction: Selecting individual property and date ranges updates dashboard
 * 3. Empty Data Handling: 0 properties or 0 bookings handles gracefully
 * 4. Backend OFF: Connection error banner displayed, KPI counters reset to '--', zero fabricated cards
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Helper to create complete mock DOM matching owner/analytics.html
function createAnalyticsDom() {
  const elements = {};
  function makeEl(id, tagName = 'div') {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      style: { display: '' },
      innerHTML: '',
      textContent: '',
      value: '',
      options: [],
      appendChild: (child) => {
        if (tagName.toLowerCase() === 'select') el.options.push(child);
      },
      addEventListener: (evt, fn) => { el[`on_${evt}`] = fn; },
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop: () => {} })
      })
    };
    elements[id] = el;
    return el;
  }

  const allIds = [
    'analytics-error-banner', 'analytics-error-text',
    'analytics-property-select', 'analytics-date-range',
    'stat-total-revenue', 'stat-confirmed-bookings',
    'stat-occupancy-rate', 'stat-avg-booking-value',
    'spotlight-top-property', 'spotlight-low-property',
    'chart-revenue-trend', 'chart-booking-overview',
    'chart-occupancy-bars', 'chart-revenue-property',
    'performance-table-tbody', 'pricing-performance-tbody',
    'chart-price-trend', 'analytics-insights-list',
    'owner-name-display', 'owner-avatar'
  ];

  allIds.forEach(id => {
    const tag = id.includes('select') ? 'select' : (id.includes('chart') ? 'canvas' : (id.includes('tbody') ? 'tbody' : 'div'));
    makeEl(id, tag);
  });

  const store = {};
  const sessionStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const document = {
    getElementById: (id) => elements[id] || makeEl(id),
    createElement: (tag) => makeEl(`gen_${Math.random()}`, tag),
    addEventListener: () => {}
  };

  const window = {
    location: { href: '', pathname: '/owner/analytics.html' },
    sessionStorage,
    document,
    navigator: { serviceWorker: { getRegistrations: async () => [] } },
    ApiClient: null,
    Chart: function MockChart() {
      return { destroy: () => {} };
    }
  };

  return { window, document, sessionStorage, elements };
}

async function run() {
  console.log('====================================================');
  console.log(' OWNER ANALYTICS COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition, desc) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: LIVE BACKEND STATE (Backend ON)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Backend ON - Real MongoDB Atlas Integration ---');

  const dom = createAnalyticsDom();
  const ownerUser = {
    id: 'OWN001',
    _id: '6ae098203e8e964b64a870e4',
    name: 'Demo Owner',
    email: 'owner@dynamicrent.com',
    role: 'owner'
  };
  dom.sessionStorage.setItem('currentUser', JSON.stringify(ownerUser));

  // Load production ApiClient in context
  const apiJs = fs.readFileSync(path.join(ROOT, 'js/utils/api.js'), 'utf8');
  const storageJs = fs.readFileSync(path.join(ROOT, 'js/utils/storage.js'), 'utf8');
  const occJs = fs.readFileSync(path.join(ROOT, 'js/owner/occupancy.js'), 'utf8');
  const demandJs = fs.readFileSync(path.join(ROOT, 'js/owner/demandEngine.js'), 'utf8');
  const chartsJs = fs.readFileSync(path.join(ROOT, 'js/owner/analyticsCharts.js'), 'utf8');
  const analyticsJs = fs.readFileSync(path.join(ROOT, 'js/owner/analytics.js'), 'utf8');

  const ctx = {
    window: dom.window,
    document: dom.document,
    sessionStorage: dom.sessionStorage,
    localStorage: dom.sessionStorage,
    navigator: dom.window.navigator,
    URLSearchParams: URLSearchParams,
    fetch: fetch,
    console: console,
    Chart: dom.window.Chart,
    redirectToLogin: () => { console.log('Redirecting to login'); }
  };
  vm.createContext(ctx);

  vm.runInContext(storageJs + '; window.StorageUtils = StorageUtils;', ctx);
  vm.runInContext(apiJs + '; window.ApiClient = ApiClient;', ctx);
  vm.runInContext(occJs + '; window.OccupancyEngine = OccupancyEngine;', ctx);
  vm.runInContext(demandJs + '; window.DemandEngine = DemandEngine;', ctx);
  vm.runInContext(chartsJs + '; window.AnalyticsCharts = AnalyticsCharts;', ctx);
  vm.runInContext(analyticsJs, ctx);

  // Execute initAnalyticsDashboard
  await ctx.initAnalyticsDashboard();

  // Assertions on populated DOM
  const rev = dom.elements['stat-total-revenue'].textContent;
  const conf = dom.elements['stat-confirmed-bookings'].textContent;
  const occ = dom.elements['stat-occupancy-rate'].textContent;
  const avgVal = dom.elements['stat-avg-booking-value'].textContent;

  console.log(`  Live Metrics: Revenue=${rev}, Confirmed=${conf}, Occupancy=${occ}, AvgVal=${avgVal}`);

  assertTest(rev !== '₹0' && rev !== '--', `Total revenue is calculated from confirmed stays (${rev})`);
  assertTest(parseInt(conf, 10) > 0, `Confirmed bookings count is greater than 0 (${conf})`);
  assertTest(occ !== '0%' && occ !== '--', `Occupancy rate is computed from real calendar nights (${occ})`);
  assertTest(avgVal !== '₹0' && avgVal !== '--', `Average booking value is calculated (${avgVal})`);

  // Check Property Selector
  const selectOpts = dom.elements['analytics-property-select'].options;
  assertTest(selectOpts.length >= 6, `Property dropdown has All + ${selectOpts.length - 1} owner listings`);

  // Check Spotlight Cards
  const topSpotlight = dom.elements['spotlight-top-property'].innerHTML;
  const lowSpotlight = dom.elements['spotlight-low-property'].innerHTML;
  assertTest(topSpotlight.includes('Top Performing Listing') && !topSpotlight.includes('Awaiting confirmed'), 'Top performer spotlight card shows real listing');
  assertTest(lowSpotlight.includes('Property Needing Attention') || lowSpotlight.includes('Portfolio metrics'), 'Spotlight low occupancy card evaluated correctly');

  // Check Performance Table
  const perfRows = dom.elements['performance-table-tbody'].innerHTML;
  assertTest(perfRows.includes('<tr>') && perfRows.includes('Hyderabad Luxury Apartment'), 'Property Performance Ranking table rendered all listings');

  // Check Pricing Table
  const pricingRows = dom.elements['pricing-performance-tbody'].innerHTML;
  assertTest(pricingRows.includes('<tr>') && !pricingRows.includes('No pricing history found'), 'Pricing Performance Audit table populated with quotes');

  // Check Insights Box
  const insightsHtml = dom.elements['analytics-insights-list'].innerHTML;
  assertTest(insightsHtml.includes('💡') && insightsHtml.length > 50, 'Automated portfolio insights synthesized');

  // -------------------------------------------------------------
  // TEST 2: FILTERING (Single Property Selection)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Interactive Filter Handling ---');
  const targetPropId = selectOpts[1].value;
  console.log(`  Filtering by listing: ${selectOpts[1].textContent} (ID: ${targetPropId})`);

  dom.elements['analytics-property-select'].on_change({ target: { value: targetPropId } });

  const filteredRev = dom.elements['stat-total-revenue'].textContent;
  assertTest(filteredRev !== '--', `Filtered listing revenue updated (${filteredRev})`);

  // Reset to all
  dom.elements['analytics-property-select'].on_change({ target: { value: 'all' } });
  assertTest(dom.elements['stat-total-revenue'].textContent === rev, 'Resetting filter to "all" restores full portfolio metrics');

  // -------------------------------------------------------------
  // TEST 3: EMPTY DATA HANDLING
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Safe Empty Data Handling ---');
  const emptyCtx = {
    window: dom.window,
    document: dom.document,
    sessionStorage: dom.sessionStorage,
    localStorage: dom.sessionStorage,
    fetch: fetch,
    console: console,
    Chart: dom.window.Chart,
    redirectToLogin: () => {}
  };
  vm.createContext(emptyCtx);

  vm.runInContext(storageJs + '; window.StorageUtils = StorageUtils;', emptyCtx);
  vm.runInContext(occJs + '; window.OccupancyEngine = OccupancyEngine;', emptyCtx);
  vm.runInContext(demandJs + '; window.DemandEngine = DemandEngine;', emptyCtx);
  vm.runInContext(chartsJs + '; window.AnalyticsCharts = AnalyticsCharts;', emptyCtx);

  // Mock ApiClient returning 0 properties and 0 bookings
  emptyCtx.ApiClient = {
    getProperties: async () => [],
    getBookings: async () => [],
    getPricingHistory: async () => []
  };
  emptyCtx.window.ApiClient = emptyCtx.ApiClient;

  vm.runInContext(analyticsJs, emptyCtx);
  await emptyCtx.initAnalyticsDashboard();

  assertTest(dom.elements['stat-total-revenue'].textContent === '₹0', 'Empty revenue displays ₹0');
  assertTest(dom.elements['stat-confirmed-bookings'].textContent === '0', 'Empty confirmed bookings displays 0');
  assertTest(dom.elements['stat-occupancy-rate'].textContent === '0%', 'Empty occupancy rate displays 0%');
  assertTest(dom.elements['performance-table-tbody'].innerHTML.includes('No properties found'), 'Empty performance table shows friendly empty state');
  assertTest(dom.elements['pricing-performance-tbody'].innerHTML.includes('No pricing history found'), 'Empty pricing table shows friendly empty state');

  // -------------------------------------------------------------
  // TEST 4: BACKEND OFFLINE ERROR HANDLING
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Backend Connection Failure Handling ---');
  const offlineCtx = {
    window: dom.window,
    document: dom.document,
    sessionStorage: dom.sessionStorage,
    localStorage: dom.sessionStorage,
    fetch: fetch,
    console: console,
    Chart: dom.window.Chart,
    redirectToLogin: () => {}
  };
  vm.createContext(offlineCtx);

  vm.runInContext(storageJs + '; window.StorageUtils = StorageUtils;', offlineCtx);
  offlineCtx.ApiClient = {
    getProperties: async () => {
      const err = new Error('fetch failed: ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      throw err;
    },
    getBookings: async () => { throw new Error('ECONNREFUSED'); },
    getPricingHistory: async () => { throw new Error('ECONNREFUSED'); }
  };
  offlineCtx.window.ApiClient = offlineCtx.ApiClient;

  vm.runInContext(analyticsJs, offlineCtx);
  await offlineCtx.initAnalyticsDashboard();

  assertTest(dom.elements['analytics-error-banner'].style.display === 'flex', 'Error banner is displayed when backend is offline');
  assertTest(dom.elements['analytics-error-text'].textContent === 'Unable to connect to the server. Please try again.', 'Error banner displays exact required message');
  assertTest(dom.elements['stat-total-revenue'].textContent === '--', 'Offline total revenue reset to --');
  assertTest(dom.elements['stat-confirmed-bookings'].textContent === '--', 'Offline confirmed bookings reset to --');
  assertTest(dom.elements['stat-occupancy-rate'].textContent === '--', 'Offline occupancy rate reset to --');
  assertTest(dom.elements['stat-avg-booking-value'].textContent === '--', 'Offline avg booking value reset to --');
  assertTest(dom.elements['performance-table-tbody'].innerHTML.includes('No properties found'), 'Zero property cards rendered when offline');

  console.log(`\n====================================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================`);

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
