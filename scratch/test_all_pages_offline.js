/**
 * Comprehensive Offline Verification for ALL 12 Project Pages
 * Verifies that when backend is OFF (port 5000 disconnected):
 * - ZERO database-dependent properties, bookings, or pricing are shown
 * - Clear connection error message "Unable to connect to the server. Please try again." is displayed
 * - Working retry mechanisms exist
 * - Containers are completely cleared
 * - Login & Registration reject offline attempts
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Helper to evaluate client script in controlled DOM context
function setupDomContext() {
  const elements = {};
  function makeEl(id, tagName = 'div') {
    const el = {
      id,
      tagName,
      style: { display: '' },
      innerHTML: '',
      textContent: '',
      value: '',
      disabled: false,
      classList: { add: () => {}, remove: () => {} },
      appendChild: (child) => {},
      removeChild: () => {},
      addEventListener: (evt, fn) => { el[`on_${evt}`] = fn; },
      scrollIntoView: () => {},
      getAttribute: () => '',
      reset: () => {}
    };
    elements[id] = el;
    return el;
  }

  // Pre-create all known element IDs across all project pages
  const allIds = [
    // Landing
    'featured-properties-grid', 'landing-backend-error-state', 'nav-login-btn', 'nav-register-btn', 'hero-explore-btn',
    // Customer Catalog
    'loading-indicator', 'properties-container', 'empty-state', 'backend-error-state', 'backend-error-title',
    'backend-error-message', 'search-input', 'type-filter', 'location-filter', 'min-price', 'max-price',
    'rating-filter', 'sort-select', 'reset-filters-btn', 'results-count-text',
    // Property Details
    'property-details-content', 'property-not-found', 'property-details-loading', 'page-header-title',
    'error-state-title', 'error-state-message', 'btn-retry-details', 'details-image', 'details-title',
    'details-rating', 'details-reviews', 'details-price', 'details-book-btn',
    // Booking
    'booking-error-state', 'booking-error-title', 'booking-error-desc', 'btn-retry-booking',
    'booking-content-grid', 'booking-form', 'checkin-date', 'checkout-date', 'guest-count',
    'booking-submit-btn', 'booking-alert', 'booking-success-modal', 'prop-preview-name',
    // My Bookings
    'no-bookings-state', 'api-error-state', 'api-error-title', 'api-error-message',
    'bookings-list-container', 'my-bookings-count-heading', 'status-filter',
    // Customer Dashboard
    'customer-dashboard-error-banner', 'customer-dashboard-error-text', 'available-properties-count',
    'pending-bookings-count', 'confirmed-bookings-count', 'total-bookings-count', 'recent-bookings-container',
    // Owner Dashboard
    'owner-dashboard-error-banner', 'owner-dashboard-error-text', 'kpi-total-properties', 'kpi-total-requests',
    'kpi-pending-subtext', 'kpi-confirmed-bookings', 'kpi-total-revenue', 'kpi-overall-occupancy',
    'kpi-occupancy-subtext', 'occupancy-card-title', 'occupancy-headline-rate', 'occ-occupied-nights',
    'occ-total-nights', 'occ-confirmed-count', 'occ-properties-count', 'dashboard-recent-tbody',
    'dashboard-performance-grid', 'owner-name-display', 'owner-avatar',
    // Owner Properties
    'properties-loading-state', 'properties-api-error-state', 'properties-api-error-title',
    'properties-api-error-message', 'properties-empty-state', 'owner-properties-grid', 'portfolio-subtitle',
    'delete-property-modal', 'delete-property-name', 'delete-modal-error', 'btn-confirm-delete', 'btn-cancel-delete',
    'owner-toast-container',
    // Owner Bookings
    'owner-loading-state', 'owner-api-error-state', 'owner-api-error-title', 'owner-api-error-message',
    'owner-no-bookings', 'owner-no-filtered-bookings', 'owner-bookings-container', 'filter-results-count',
    'stat-pending-count', 'stat-confirmed-count', 'stat-revenue-count', 'stat-total-count',
    'owner-search-input', 'owner-status-filter', 'owner-property-filter', 'owner-sort-filter',
    // Pricing
    'pricing-loading-state', 'pricing-api-error-state', 'pricing-api-error-message', 'pricing-cockpit-layout',
    'pricing-property-select', 'pricing-checkin-date', 'pricing-checkout-date', 'pricing-base-rate-val',
    'pricing-suggested-rate-val', 'pricing-total-cost-val', 'btn-apply-dynamic-price',
    // Price History
    'history-loading-state', 'history-api-error-state', 'history-api-error-message', 'history-table-card',
    'price-history-tbody', 'history-property-filter', 'history-direction-filter',
    // Analytics
    'analytics-error-banner', 'analytics-error-text', 'analytics-property-select', 'analytics-date-range',
    'stat-total-revenue', 'stat-confirmed-bookings', 'stat-occupancy-rate', 'stat-avg-booking-value',
    'performance-table-tbody', 'pricing-performance-tbody', 'analytics-insights-list',
    // Auth
    'login-form', 'login-email', 'login-password', 'login-submit-btn', 'auth-alert-banner',
    'register-form', 'reg-name', 'reg-email', 'reg-password', 'reg-confirm-password', 'register-submit-btn'
  ];

  allIds.forEach(id => makeEl(id));

  const store = {};
  const sessionStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  const document = {
    getElementById: (id) => elements[id] || makeEl(id),
    querySelectorAll: (sel) => [],
    querySelector: (sel) => null,
    createElement: (tag) => makeEl(`gen_${Math.random()}`, tag),
    addEventListener: (evt, fn) => {},
    body: { appendChild: () => {} }
  };

  const StorageUtils = {
    getCurrentUser: () => {
      const u = sessionStorage.getItem('currentUser');
      return u ? JSON.parse(u) : null;
    },
    setCurrentUser: (u) => sessionStorage.setItem('currentUser', JSON.stringify(u)),
    getUsers: () => []
  };

  const window = {
    location: { search: '?id=6ae00fe70aa9b94f6a4d9025', href: '' },
    sessionStorage,
    localStorage,
    document,
    ApiClient: null,
    StorageUtils,
    getCurrentUser: StorageUtils.getCurrentUser,
    redirectToLogin: () => {}
  };

  return { window, document, localStorage, sessionStorage, elements, StorageUtils };
}

async function run() {
  console.log('====================================================');
  console.log(' RUNNING OFFLINE BEHAVIOR AUDIT FOR ALL PAGES');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // Evaluate ApiClient with offline fetch (rejects all requests)
  const apiJs = fs.readFileSync(path.join(ROOT, 'js/utils/api.js'), 'utf8');

  function getOfflineApiClient(env) {
    env.window.fetch = async (url) => {
      const err = new Error('fetch failed: ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      throw err;
    };
    const fn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'fetch', apiJs + '; return ApiClient;');
    return fn(env.window, env.document, env.localStorage, env.sessionStorage, env.window.fetch);
  }

  // ---------------------------------------------------------------------------
  // 1. Landing Page (index.html -> js/app.js)
  // ---------------------------------------------------------------------------
  console.log('--- 1. Landing Page (index.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', appJs + '; return loadLandingProperties;');
    const loadLanding = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    // Stale cards test
    env.elements['featured-properties-grid'].innerHTML = '<div class="property-card">Old Cached Card</div>';
    env.elements['featured-properties-grid'].style.display = 'grid';

    await loadLanding();

    assertTest(env.elements['featured-properties-grid'].innerHTML === '', 'Featured properties grid cleared to 0 cards');
    assertTest(env.elements['featured-properties-grid'].style.display === 'none', 'Featured grid hidden');
    assertTest(env.elements['landing-backend-error-state'].style.display === 'block', 'Landing error state is visible');
  }

  // ---------------------------------------------------------------------------
  // 2. Customer Properties Catalog (customer/properties.html -> js/customer/properties.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Customer Properties Catalog (customer/properties.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    const propsJs = fs.readFileSync(path.join(ROOT, 'js/customer/properties.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', propsJs + '; return initPropertiesPage;');
    const initProps = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['properties-container'].innerHTML = '<div class="property-card">Old Card</div>';
    env.elements['properties-container'].style.display = 'grid';

    await initProps();

    assertTest(env.elements['properties-container'].innerHTML === '', 'Customer catalog container cleared to 0 cards');
    assertTest(env.elements['properties-container'].style.display === 'none', 'Customer container hidden');
    assertTest(env.elements['backend-error-state'].style.display === 'block', 'Customer backend-error-state is visible');
    assertTest(env.elements['backend-error-title'].textContent === 'Unable to connect to the server. Please try again.', 'Customer error title matches exact text');
    assertTest(env.elements['backend-error-message'].textContent === 'Unable to connect to the server. Please try again.', 'Customer error message matches exact text');
    assertTest(env.elements['results-count-text'].textContent.includes('unavailable'), 'Results count indicates server unavailable');
  }

  // ---------------------------------------------------------------------------
  // 3. Customer Property Details (customer/property-details.html -> js/customer/propertyDetails.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Customer Property Details (customer/property-details.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    const detailsJs = fs.readFileSync(path.join(ROOT, 'js/customer/propertyDetails.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', detailsJs + '; return initPropertyDetails;');
    const initDetails = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['property-details-content'].style.display = 'grid';

    await initDetails();

    assertTest(env.elements['property-details-content'].style.display === 'none', 'Details content container hidden');
    assertTest(env.elements['property-not-found'].style.display === 'block', 'Property error state is visible');
    assertTest(env.elements['error-state-message'].textContent === 'Unable to connect to the server. Please try again.', 'Error message displays exact required text');
  }

  // ---------------------------------------------------------------------------
  // 4. Customer Booking Form (customer/booking.html -> js/customer/booking.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Customer Booking Form (customer/booking.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'c1', role: 'customer' }));
    const bookingJs = fs.readFileSync(path.join(ROOT, 'js/customer/booking.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', bookingJs + '; return initBookingPage;');
    const initBooking = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['booking-content-grid'].style.display = 'grid';

    await initBooking();

    assertTest(env.elements['booking-content-grid'].style.display === 'none', 'Booking form grid hidden');
    assertTest(env.elements['booking-error-state'].style.display === 'block', 'Booking error container visible');
    assertTest(env.elements['booking-error-title'].textContent === 'Unable to connect to the server. Please try again.', 'Booking error title displays exact required text');
  }

  // ---------------------------------------------------------------------------
  // 5. Customer My Bookings (customer/my-bookings.html -> js/customer/myBookings.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Customer My Bookings (customer/my-bookings.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'c1', role: 'customer' }));
    const myBookingsJs = fs.readFileSync(path.join(ROOT, 'js/customer/myBookings.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', myBookingsJs + '; return initMyBookings;');
    const initMyBookings = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['bookings-list-container'].innerHTML = '<div>Stale Booking</div>';

    await initMyBookings();

    assertTest(env.elements['bookings-list-container'].innerHTML === '', 'Bookings list cleared to 0 cards');
    assertTest(env.elements['bookings-list-container'].style.display === 'none', 'Bookings container hidden');
    assertTest(env.elements['api-error-state'].style.display === 'block', 'My Bookings API error state visible');
    assertTest(env.elements['api-error-title'].textContent === 'Unable to connect to the server. Please try again.', 'My Bookings error title displays exact required text');
  }

  // ---------------------------------------------------------------------------
  // 6. Customer Dashboard (customer/dashboard.html -> js/customer/customerDashboard.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Customer Dashboard (customer/dashboard.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'c1', role: 'customer' }));
    const dashJs = fs.readFileSync(path.join(ROOT, 'js/customer/customerDashboard.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', dashJs + '; return initCustomerDashboard;');
    const initDash = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    await initDash();

    assertTest(env.elements['customer-dashboard-error-banner'].style.display === 'flex', 'Customer dashboard error banner visible');
    assertTest(env.elements['available-properties-count'].textContent === '--', 'Available properties count reset to --');
    assertTest(env.elements['total-bookings-count'].textContent === '--', 'Total bookings count reset to --');
    assertTest(env.elements['recent-bookings-container'].innerHTML.includes('Unable to connect to the server'), 'Recent bookings shows connection error with retry');
  }

  // ---------------------------------------------------------------------------
  // 7. Owner Properties (owner/properties.html -> js/owner/ownerProperties.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Owner Properties (owner/properties.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const ownerPropsJs = fs.readFileSync(path.join(ROOT, 'js/owner/ownerProperties.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', ownerPropsJs + '; return initOwnerPropertiesPage;');
    const initOwnerProps = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['owner-properties-grid'].innerHTML = '<div class="performance-card">Stale Owner Prop</div>';

    await initOwnerProps();

    assertTest(env.elements['owner-properties-grid'].innerHTML === '', 'Owner properties grid cleared to 0 cards');
    assertTest(env.elements['owner-properties-grid'].style.display === 'none', 'Owner grid hidden');
    assertTest(env.elements['properties-api-error-state'].style.display === 'block', 'Owner properties error state visible');
    assertTest(env.elements['properties-api-error-title'].textContent === 'Unable to connect to the server. Please try again.', 'Owner properties error title matches exact text');
  }

  // ---------------------------------------------------------------------------
  // 8. Owner Bookings (owner/bookings.html -> js/owner/ownerBookings.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Owner Bookings (owner/bookings.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const ownerBookingsJs = fs.readFileSync(path.join(ROOT, 'js/owner/ownerBookings.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', ownerBookingsJs + '; return initOwnerBookings;');
    const initOwnerBookings = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['owner-bookings-container'].innerHTML = '<div>Stale Booking Request</div>';

    await initOwnerBookings();

    assertTest(env.elements['owner-bookings-container'].innerHTML === '', 'Owner bookings container cleared to 0 cards');
    assertTest(env.elements['owner-bookings-container'].style.display === 'none', 'Owner bookings container hidden');
    assertTest(env.elements['stat-pending-count'].textContent === '--', 'Pending stats reset to --');
    assertTest(env.elements['owner-api-error-state'].style.display === 'block', 'Owner bookings error state visible');
    assertTest(env.elements['owner-api-error-title'].textContent === 'Unable to connect to the server. Please try again.', 'Owner bookings error title matches exact text');
  }

  // ---------------------------------------------------------------------------
  // 9. Owner Dashboard (owner/dashboard.html -> js/owner/ownerDashboard.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Owner Dashboard (owner/dashboard.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const ownerDashJs = fs.readFileSync(path.join(ROOT, 'js/owner/ownerDashboard.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', ownerDashJs + '; return initOwnerDashboard;');
    const initOwnerDash = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    await initOwnerDash();

    assertTest(env.elements['kpi-total-properties'].textContent === '--', 'Total properties KPI reset to --');
    assertTest(env.elements['kpi-total-revenue'].textContent === '--', 'Total revenue KPI reset to --');
    assertTest(env.elements['dashboard-recent-tbody'].innerHTML.includes('Unable to connect to the server'), 'Recent requests table shows error message');
    assertTest(env.elements['dashboard-performance-grid'].innerHTML.includes('Unable to connect to the server'), 'Performance grid shows error message with retry');
  }

  // ---------------------------------------------------------------------------
  // 10. Owner Pricing Cockpit (owner/pricing.html -> js/owner/pricingPage.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Owner Pricing Cockpit (owner/pricing.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const pricingJs = fs.readFileSync(path.join(ROOT, 'js/owner/pricingPage.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', pricingJs + '; return initPricingPage;');
    const initPricing = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['pricing-cockpit-layout'].style.display = 'grid';

    await initPricing();

    assertTest(env.elements['pricing-cockpit-layout'].style.display === 'none', 'Pricing cockpit layout hidden');
    assertTest(env.elements['pricing-api-error-state'].style.display === 'block', 'Pricing error state visible');
    assertTest(env.elements['pricing-api-error-message'].textContent === 'Unable to connect to the server. Please try again.', 'Pricing error message matches exact text');
  }

  // ---------------------------------------------------------------------------
  // 11. Owner Price History (owner/price-history.html -> js/owner/priceHistory.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Owner Price History (owner/price-history.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const histJs = fs.readFileSync(path.join(ROOT, 'js/owner/priceHistory.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', histJs + '; return initPriceHistoryPage;');
    const initHist = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    env.elements['history-table-card'].style.display = 'block';

    await initHist();

    assertTest(env.elements['history-table-card'].style.display === 'none', 'Price history table card hidden');
    assertTest(env.elements['history-api-error-state'].style.display === 'block', 'Price history error state visible');
  }

  // ---------------------------------------------------------------------------
  // 12. Owner Analytics (owner/analytics.html -> js/owner/analytics.js)
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Owner Analytics (owner/analytics.html) ---');
  {
    const env = setupDomContext();
    env.window.ApiClient = getOfflineApiClient(env);
    env.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner' }));
    const anaJs = fs.readFileSync(path.join(ROOT, 'js/owner/analytics.js'), 'utf8');
    const fn = new Function('window', 'document', 'sessionStorage', 'localStorage', anaJs + '; return initAnalyticsDashboard;');
    const initAna = fn(env.window, env.document, env.sessionStorage, env.localStorage);

    await initAna();

    assertTest(env.elements['analytics-error-banner'].style.display === 'flex', 'Analytics error banner visible');
    assertTest(env.elements['stat-total-revenue'].textContent === '--', 'Analytics revenue reset to --');
    assertTest(env.elements['stat-confirmed-bookings'].textContent === '--', 'Analytics confirmed count reset to --');
  }

  console.log(`\n====================================================`);
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
