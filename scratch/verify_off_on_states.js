/**
 * DynamicRent - Comprehensive Verification Suite for Backend OFF and ON states
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// Minimal Browser DOM Environment for testing frontend scripts
function createMockBrowserEnv() {
  const storage = {};
  const sessionStorageStore = {};

  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };

  const sessionStorage = {
    getItem: (k) => (k in sessionStorageStore ? sessionStorageStore[k] : null),
    setItem: (k, v) => { sessionStorageStore[k] = String(v); },
    removeItem: (k) => { delete sessionStorageStore[k]; },
    clear: () => { Object.keys(sessionStorageStore).forEach(k => delete sessionStorageStore[k]); }
  };

  class MockElement {
    constructor(id = '', tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.style = { display: '' };
      this.innerHTML = '';
      this.textContent = '';
      this.className = '';
      this.classList = {
        add: () => {},
        remove: () => {},
        contains: () => false
      };
      this.children = [];
      this.attributes = {};
    }

    setAttribute(name, val) { this.attributes[name] = val; }
    getAttribute(name) { return this.attributes[name] || null; }
    appendChild(child) { this.children.push(child); }
    addEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }

  const elements = {};

  function getElementById(id) {
    if (!elements[id]) {
      elements[id] = new MockElement(id);
    }
    return elements[id];
  }

  const document = {
    getElementById,
    createElement: (tag) => new MockElement('', tag),
    querySelector: (sel) => {
      if (sel.startsWith('#')) return getElementById(sel.slice(1));
      return null;
    },
    querySelectorAll: (sel) => [],
    addEventListener: () => {}
  };

  const window = {
    location: { search: '', href: '' },
    localStorage,
    sessionStorage,
    document,
    addEventListener: () => {},
    ApiClient: null
  };

  return { window, document, localStorage, sessionStorage, elements };
}

// Test Suite 1: Backend OFF State Verification
async function runOfflineTests() {
  console.log('\n======================================================');
  console.log('🧪 TEST 1: BACKEND SERVER IS OFF (Port 5000 Inactive)');
  console.log('======================================================');

  // Verify server is indeed not reachable on port 5000
  let isPort5000Open = false;
  try {
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:5000/api/health', () => {
        isPort5000Open = true;
        resolve();
      });
      req.on('error', () => {
        isPort5000Open = false;
        resolve();
      });
      req.setTimeout(1500, () => {
        req.destroy();
        resolve();
      });
    });
  } catch (e) {
    isPort5000Open = false;
  }

  assert(!isPort5000Open, 'Backend port 5000 is OFF / not accepting connections.');

  // Check 1A: ApiClient throws standardized offline error
  const apiJsContent = fs.readFileSync(path.join(workspaceRoot, 'js', 'utils', 'api.js'), 'utf-8');
  const mockEnv = createMockBrowserEnv();
  
  // Evaluate ApiClient in mockEnv
  const evalApi = new Function('window', 'document', 'localStorage', 'sessionStorage', apiJsContent);
  evalApi(mockEnv.window, mockEnv.document, mockEnv.localStorage, mockEnv.sessionStorage);
  
  let offlineErrorThrown = false;
  let offlineErrorMessage = '';
  try {
    await mockEnv.window.ApiClient.getProperties();
  } catch (err) {
    offlineErrorThrown = true;
    offlineErrorMessage = err.message;
  }

  assert(offlineErrorThrown, 'ApiClient.getProperties() throws error when backend is OFF.');
  assert(
    offlineErrorMessage === 'Unable to connect to the server. Please try again.',
    `ApiClient offline error message is exact: "${offlineErrorMessage}"`
  );

  // Check 1B: propertyData.js clears dynamicRentProperties and doesn't seed into localStorage
  mockEnv.localStorage.setItem('dynamicRentProperties', JSON.stringify([{ id: 'stale1', name: 'Stale Property' }]));
  mockEnv.localStorage.setItem('dynamicRentUsers', JSON.stringify([{ id: 'u1', name: 'Existing User' }]));
  mockEnv.localStorage.setItem('dynamicRentBookings', JSON.stringify([{ id: 'b1', propertyId: 'p1' }]));

  const propertyDataJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'data', 'propertyData.js'), 'utf-8');
  const evalPropData = new Function('window', 'document', 'localStorage', 'sessionStorage', propertyDataJs);
  evalPropData(mockEnv.window, mockEnv.document, mockEnv.localStorage, mockEnv.sessionStorage);

  assert(
    mockEnv.localStorage.getItem('dynamicRentProperties') === null,
    'propertyData.js successfully removed stale dynamicRentProperties cache.'
  );
  assert(
    mockEnv.localStorage.getItem('dynamicRentUsers') !== null,
    'propertyData.js did NOT delete user accounts (dynamicRentUsers preserved).'
  );
  assert(
    mockEnv.localStorage.getItem('dynamicRentBookings') !== null,
    'propertyData.js did NOT delete bookings (dynamicRentBookings preserved).'
  );

  // Check 1C: storage.js getProperties returns empty array
  const storageJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'utils', 'storage.js'), 'utf-8');
  const evalStorage = new Function('window', 'document', 'localStorage', 'sessionStorage', storageJs);
  evalStorage(mockEnv.window, mockEnv.document, mockEnv.localStorage, mockEnv.sessionStorage);
  const storageProps = mockEnv.window.StorageUtils.getProperties();
  assert(Array.isArray(storageProps) && storageProps.length === 0, 'StorageUtils.getProperties() returns [] (never falls back to demo data).');

  // Check 1D: Landing Page (js/app.js) offline behavior
  const appJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'app.js'), 'utf-8');
  const landingEnv = createMockBrowserEnv();
  evalApi(landingEnv.window, landingEnv.document, landingEnv.localStorage, landingEnv.sessionStorage);
  
  // Set up elements for landing page
  const featuredGrid = landingEnv.elements['featured-properties-grid'] = landingEnv.window.document.createElement('div');
  const landingError = landingEnv.elements['landing-backend-error-state'] = landingEnv.window.document.createElement('div');
  const landingLoading = landingEnv.elements['landing-loading-state'] = landingEnv.window.document.createElement('div');

  const evalApp = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', appJs + '; return loadLandingProperties;');
  const loadLandingProperties = evalApp(landingEnv.window, landingEnv.document, landingEnv.localStorage, landingEnv.sessionStorage, landingEnv.window.ApiClient);
  
  await loadLandingProperties();

  assert(featuredGrid.innerHTML === '', 'Landing page: featured properties grid innerHTML is empty (0 cards rendered).');
  assert(landingError.style.display === 'block', 'Landing page: landing-backend-error-state is displayed (display: block).');

  // Check 1E: Customer Dashboard (js/customer/customerDashboard.js) offline behavior
  const custDashJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'customer', 'customerDashboard.js'), 'utf-8');
  const custEnv = createMockBrowserEnv();
  evalApi(custEnv.window, custEnv.document, custEnv.localStorage, custEnv.sessionStorage);
  evalStorage(custEnv.window, custEnv.document, custEnv.localStorage, custEnv.sessionStorage);
  
  custEnv.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'USR001', role: 'customer', name: 'Test Customer' }));
  const custBanner = custEnv.elements['customer-dashboard-error-banner'] = custEnv.window.document.createElement('div');
  const custBannerText = custEnv.elements['customer-dashboard-error-text'] = custEnv.window.document.createElement('span');
  const custRecent = custEnv.elements['recent-bookings-container'] = custEnv.window.document.createElement('div');

  const evalCustDash = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', 'StorageUtils', custDashJs + '; return initCustomerDashboard;');
  const initCustomerDashboard = evalCustDash(custEnv.window, custEnv.document, custEnv.localStorage, custEnv.sessionStorage, custEnv.window.ApiClient, custEnv.window.StorageUtils);
  
  await initCustomerDashboard();

  assert(custBanner.style.display === 'flex', 'Customer Dashboard: error banner is displayed (display: flex).');
  assert(custBannerText.textContent === 'Unable to connect to the server. Please try again.', 'Customer Dashboard: banner shows exact offline message.');
  assert(
    custRecent.innerHTML.includes('Unable to connect to the server. Please try again.') &&
    !custRecent.innerHTML.includes('property-card') &&
    !custRecent.innerHTML.includes('featured-property-card'),
    'Customer Dashboard: recent properties container displays retry message and ZERO property cards.'
  );

  // Check 1F: Owner Dashboard (js/owner/ownerDashboard.js) offline behavior
  const ownerDashJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'owner', 'ownerDashboard.js'), 'utf-8');
  const ownerEnv = createMockBrowserEnv();
  evalApi(ownerEnv.window, ownerEnv.document, ownerEnv.localStorage, ownerEnv.sessionStorage);
  evalStorage(ownerEnv.window, ownerEnv.document, ownerEnv.localStorage, ownerEnv.sessionStorage);

  ownerEnv.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner', name: 'Test Owner' }));
  const ownerBanner = ownerEnv.elements['owner-dashboard-error-banner'] = ownerEnv.window.document.createElement('div');
  const ownerBannerText = ownerEnv.elements['owner-dashboard-error-text'] = ownerEnv.window.document.createElement('span');
  const ownerPerf = ownerEnv.elements['dashboard-performance-grid'] = ownerEnv.window.document.createElement('div');

  const evalOwnerDash = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', 'StorageUtils', ownerDashJs + '; return initOwnerDashboard;');
  const initOwnerDashboard = evalOwnerDash(ownerEnv.window, ownerEnv.document, ownerEnv.localStorage, ownerEnv.sessionStorage, ownerEnv.window.ApiClient, ownerEnv.window.StorageUtils);

  await initOwnerDashboard();

  assert(ownerBanner.style.display === 'flex', 'Owner Dashboard: error banner is displayed (display: flex).');
  assert(ownerBannerText.textContent === 'Unable to connect to the server. Please try again.', 'Owner Dashboard: banner shows exact offline message.');
  assert(
    ownerPerf.innerHTML.includes('Unable to connect to the server. Please try again.') &&
    !ownerPerf.innerHTML.includes('performance-card') &&
    !ownerPerf.innerHTML.includes('owner-property-card'),
    'Owner Dashboard: performance grid displays retry button and ZERO property cards.'
  );

  // Check 1G: Customer Properties Catalog (js/customer/properties.js) offline behavior
  const propsCatalogJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'customer', 'properties.js'), 'utf-8');
  const catalogEnv = createMockBrowserEnv();
  evalApi(catalogEnv.window, catalogEnv.document, catalogEnv.localStorage, catalogEnv.sessionStorage);

  const catalogContainer = catalogEnv.elements['properties-container'] = catalogEnv.window.document.createElement('div');
  const catalogBackendErr = catalogEnv.elements['backend-error-state'] = catalogEnv.window.document.createElement('div');
  const catalogBackendErrMsg = catalogEnv.elements['backend-error-message'] = catalogEnv.window.document.createElement('p');

  const evalCatalog = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', propsCatalogJs + '; return initPropertiesPage;');
  const initPropertiesPage = evalCatalog(catalogEnv.window, catalogEnv.document, catalogEnv.localStorage, catalogEnv.sessionStorage, catalogEnv.window.ApiClient);

  await initPropertiesPage();

  assert(catalogContainer.innerHTML === '', 'Customer Properties Catalog: properties container is empty (0 cards rendered).');
  assert(catalogBackendErr.style.display === 'block', 'Customer Properties Catalog: backend-error-state is displayed.');
  assert(catalogBackendErrMsg.textContent === 'Unable to connect to the server. Please try again.', 'Customer Properties Catalog: shows exact offline message.');

  // Check 1H: Owner Properties Page (js/owner/ownerProperties.js) offline behavior
  const ownerPropsJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'owner', 'ownerProperties.js'), 'utf-8');
  const ownerPropsEnv = createMockBrowserEnv();
  evalApi(ownerPropsEnv.window, ownerPropsEnv.document, ownerPropsEnv.localStorage, ownerPropsEnv.sessionStorage);
  evalStorage(ownerPropsEnv.window, ownerPropsEnv.document, ownerPropsEnv.localStorage, ownerPropsEnv.sessionStorage);
  ownerPropsEnv.sessionStorage.setItem('currentUser', JSON.stringify({ id: 'OWN001', role: 'owner', name: 'Test Owner' }));

  const ownerPropsGrid = ownerPropsEnv.elements['owner-properties-grid'] = ownerPropsEnv.window.document.createElement('div');
  const ownerPropsError = ownerPropsEnv.elements['properties-api-error-state'] = ownerPropsEnv.window.document.createElement('div');
  const ownerPropsErrorMsg = ownerPropsEnv.elements['properties-api-error-message'] = ownerPropsEnv.window.document.createElement('p');

  const evalOwnerProps = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', 'StorageUtils', ownerPropsJs + '; return initOwnerPropertiesPage;');
  const initOwnerPropertiesPage = evalOwnerProps(ownerPropsEnv.window, ownerPropsEnv.document, ownerPropsEnv.localStorage, ownerPropsEnv.sessionStorage, ownerPropsEnv.window.ApiClient, ownerPropsEnv.window.StorageUtils);

  await initOwnerPropertiesPage();

  assert(ownerPropsGrid.innerHTML === '', 'Owner Properties Page: properties grid is empty (0 cards rendered).');
  assert(ownerPropsError.style.display === 'block', 'Owner Properties Page: properties-api-error-state is displayed.');
  assert(ownerPropsErrorMsg.textContent === 'Unable to connect to the server. Please try again.', 'Owner Properties Page: shows exact offline message.');
}

// Test Suite 2: Backend ON State Verification
async function runOnlineTests() {
  console.log('\n======================================================');
  console.log('🧪 TEST 2: BACKEND SERVER IS ON (Port 5000 Active)');
  console.log('======================================================');

  console.log('Starting backend server process (node server.js)...');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(workspaceRoot, 'backend'),
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    console.log('[Server stdout]', d.toString().trim());
  });

  serverProcess.stderr.on('data', (d) => {
    console.error('[Server stderr]', d.toString().trim());
  });

  // Wait for server to come up
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:5000/api/health', (r) => {
          let body = '';
          r.on('data', c => body += c);
          r.on('end', () => resolve({ status: r.statusCode, body }));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {
      // Keep polling
    }
  }

  assert(serverReady, 'Backend server started successfully and /api/health returned 200.');

  try {
    // Fetch live properties from MongoDB Atlas via API
    const liveProps = await new Promise((resolve, reject) => {
      http.get('http://localhost:5000/api/properties', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    assert(liveProps.status === 200, `GET /api/properties returned HTTP 200 OK.`);
    assert(Array.isArray(liveProps.data.data), 'GET /api/properties returned properties array from MongoDB Atlas.');
    assert(liveProps.data.data.length > 0, `MongoDB Atlas contains ${liveProps.data.data.length} real properties.`);

    const firstProp = liveProps.data.data[0];
    console.log(`  Sample property from MongoDB: "${firstProp.name || firstProp.title}" in ${firstProp.location} (ID: ${firstProp._id || firstProp.id})`);

    // Verify frontend landing page loads properties when server is ON
    const apiJsContent = fs.readFileSync(path.join(workspaceRoot, 'js', 'utils', 'api.js'), 'utf-8');
    const appJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'app.js'), 'utf-8');
    const onlineEnv = createMockBrowserEnv();
    
    // Provide real fetch using native global fetch
    onlineEnv.window.fetch = globalThis.fetch;
    const evalApi = new Function('window', 'document', 'localStorage', 'sessionStorage', apiJsContent);
    evalApi(onlineEnv.window, onlineEnv.document, onlineEnv.localStorage, onlineEnv.sessionStorage);

    const featuredGrid = onlineEnv.elements['featured-properties-grid'] = onlineEnv.window.document.createElement('div');
    const landingError = onlineEnv.elements['landing-backend-error-state'] = onlineEnv.window.document.createElement('div');
    const landingLoading = onlineEnv.elements['landing-loading-state'] = onlineEnv.window.document.createElement('div');

    const evalApp = new Function('window', 'document', 'localStorage', 'sessionStorage', 'ApiClient', appJs + '; return loadLandingProperties;');
    const loadLandingProperties = evalApp(onlineEnv.window, onlineEnv.document, onlineEnv.localStorage, onlineEnv.sessionStorage, onlineEnv.window.ApiClient);

    await loadLandingProperties();

    assert(
      landingError.style.display === 'none',
      'Landing page: backend-error-state is hidden (display: none) when server is ON.'
    );
    assert(
      featuredGrid.innerHTML.includes('property-card') || featuredGrid.innerHTML.includes('featured-property-card') || featuredGrid.innerHTML.length > 0,
      'Landing page: successfully rendered property cards from MongoDB Atlas when server is ON.'
    );

  } finally {
    console.log('\nStopping backend server...');
    serverProcess.kill('SIGINT');
    serverProcess.kill('SIGTERM');
    try {
      process.kill(serverProcess.pid);
    } catch (e) {}
  }
}

async function run() {
  console.log('Starting DynamicRent Offline & Online Verification...');
  await runOfflineTests();
  await runOnlineTests();

  console.log('\n======================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('======================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
