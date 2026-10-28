/**
 * Automated Verification Suite for Offline Fallback Removal & MongoDB CRUD Persistence
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const workspaceRoot = path.resolve(__dirname, '..');

// Load environment variables for DB check
require(path.join(workspaceRoot, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(workspaceRoot, 'backend', '.env')
});
const mongoose = require(path.join(workspaceRoot, 'backend', 'node_modules', 'mongoose'));
const jwt = require(path.join(workspaceRoot, 'backend', 'node_modules', 'jsonwebtoken'));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function requestHttp(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 DYNAMICRENT OFFLINE HANDLING & BACKEND CRUD TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: ApiClient Offline Network Error Handling
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: ApiClient Error Handling on Network Failure ---');
  const ApiClient = require(path.join(workspaceRoot, 'js', 'utils', 'api.js'));
  const originalBaseUrl = ApiClient.BASE_URL;

  // Point to a dead/unbound port to simulate server offline
  ApiClient.BASE_URL = 'http://localhost:59999/api';

  let offlineErrorCaught = null;
  try {
    await ApiClient.getProperties();
  } catch (err) {
    offlineErrorCaught = err;
  }

  assert(
    offlineErrorCaught !== null,
    'ApiClient throws when backend server is stopped / unreachable'
  );
  assert(
    offlineErrorCaught && offlineErrorCaught.message === 'Unable to connect to the server. Please try again.',
    `ApiClient throws exact error message: "${offlineErrorCaught ? offlineErrorCaught.message : ''}"`
  );

  // Restore live BASE_URL
  ApiClient.BASE_URL = originalBaseUrl;

  // -------------------------------------------------------------------------
  // SUITE 2: Hardcoded Property Removal & Error Elements in HTML Files
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: HTML Static Card Auditing & Error States ---');

  const indexHtml = fs.readFileSync(path.join(workspaceRoot, 'index.html'), 'utf8');
  assert(
    !indexHtml.includes('Green Valley Villa') && !indexHtml.includes('Urban Heights Apartment'),
    'index.html: Hardcoded static property cards removed from landing page HTML'
  );
  assert(
    indexHtml.includes('id="landing-backend-error-state"'),
    'index.html: Contains #landing-backend-error-state'
  );
  assert(
    indexHtml.includes('Unable to connect to the server. Please try again.'),
    'index.html: Contains error text "Unable to connect to the server. Please try again."'
  );
  assert(
    indexHtml.includes('<script src="js/utils/api.js"></script>'),
    'index.html: Loads js/utils/api.js'
  );

  const customerDashHtml = fs.readFileSync(path.join(workspaceRoot, 'customer', 'dashboard.html'), 'utf8');
  assert(
    customerDashHtml.includes('customer-dashboard-error-banner'),
    'customer/dashboard.html: Contains #customer-dashboard-error-banner'
  );
  assert(
    customerDashHtml.includes('js/utils/api.js'),
    'customer/dashboard.html: Loads js/utils/api.js'
  );

  const ownerDashHtml = fs.readFileSync(path.join(workspaceRoot, 'owner', 'dashboard.html'), 'utf8');
  assert(
    ownerDashHtml.includes('owner-dashboard-error-banner'),
    'owner/dashboard.html: Contains #owner-dashboard-error-banner'
  );
  assert(
    ownerDashHtml.includes('js/utils/api.js'),
    'owner/dashboard.html: Loads js/utils/api.js'
  );

  const customerPropHtml = fs.readFileSync(path.join(workspaceRoot, 'customer', 'properties.html'), 'utf8');
  assert(
    customerPropHtml.includes('Unable to connect to the server. Please try again.'),
    'customer/properties.html: Error state contains "Unable to connect to the server. Please try again."'
  );

  const ownerPropHtml = fs.readFileSync(path.join(workspaceRoot, 'owner', 'properties.html'), 'utf8');
  assert(
    ownerPropHtml.includes('Unable to connect to the server. Please try again.'),
    'owner/properties.html: Error state contains "Unable to connect to the server. Please try again."'
  );

  const ownerBookingsHtml = fs.readFileSync(path.join(workspaceRoot, 'owner', 'bookings.html'), 'utf8');
  assert(
    ownerBookingsHtml.includes('Unable to connect to the server. Please try again.'),
    'owner/bookings.html: Error state contains "Unable to connect to the server. Please try again."'
  );

  const ownerPricingHtml = fs.readFileSync(path.join(workspaceRoot, 'owner', 'pricing.html'), 'utf8');
  assert(
    ownerPricingHtml.includes('Unable to connect to the server. Please try again.'),
    'owner/pricing.html: Error state contains "Unable to connect to the server. Please try again."'
  );

  // -------------------------------------------------------------------------
  // SUITE 3: Codebase Audit for Silent Fallbacks
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 3: Auditing JS Files for Silent Fallback Removal ---');

  const pricingPageJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'owner', 'pricingPage.js'), 'utf8');
  assert(
    !pricingPageJs.includes('trying localStorage fallback'),
    'js/owner/pricingPage.js: Removed localStorage fallback in populateOwnerProperties'
  );

  const priceHistoryJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'owner', 'priceHistory.js'), 'utf8');
  assert(
    !priceHistoryJs.includes('trying localStorage:'),
    'js/owner/priceHistory.js: Removed localStorage fallback in fetchOwnerProperties'
  );

  const ownerBookingsJs = fs.readFileSync(path.join(workspaceRoot, 'js', 'owner', 'ownerBookings.js'), 'utf8');
  assert(
    !ownerBookingsJs.includes('trying localStorage:'),
    'js/owner/ownerBookings.js: Removed localStorage fallback in fetchOwnerProperties'
  );

  // -------------------------------------------------------------------------
  // SUITE 4: Backend API Status & Health Check
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Backend API & MongoDB Atlas Status ---');
  const healthRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET'
  });

  assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
  assert(
    healthRes.data && healthRes.data.database && healthRes.data.database.connected === true,
    'MongoDB Atlas database is connected'
  );

  // -------------------------------------------------------------------------
  // SUITE 5: Authentication & JWT Login
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: Authenticate as Owner via API ---');
  const loginRes = await requestHttp(
    {
      host: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      email: 'owner@dynamicrent.com',
      password: '123456'
    }
  );

  assert(loginRes.status === 200, 'POST /api/auth/login succeeds with HTTP 200');
  const token = loginRes.data && loginRes.data.token;
  assert(typeof token === 'string' && token.length > 20, 'JWT token returned on login');

  // -------------------------------------------------------------------------
  // SUITE 6: MongoDB Property CRUD Operations & Persistence Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 6: Property Create, Read, Update, Delete & Persistence ---');

  // 1. Initial count
  const initialPropsRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: '/api/properties',
    method: 'GET'
  });
  const initialCount = (initialPropsRes.data && initialPropsRes.data.data) ? initialPropsRes.data.data.length : 0;
  console.log(`  ℹ️  Current properties in MongoDB Atlas: ${initialCount}`);

  // 2. CREATE a new property via POST /api/properties (using owner JWT)
  const testPropPayload = {
    title: 'Verification Suite Test Villa',
    description: 'Temporary test property to verify backend MongoDB Atlas CRUD persistence.',
    location: 'Goa',
    propertyType: 'Villa',
    pricePerNight: 8500,
    bedrooms: 3,
    bathrooms: 2,
    amenities: ['Pool', 'WiFi', 'Ocean View'],
    ownerId: 'OWN001'
  };

  const createRes = await requestHttp(
    {
      host: 'localhost',
      port: 5000,
      path: '/api/properties',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    },
    testPropPayload
  );

  assert(createRes.status === 201, `POST /api/properties returned HTTP 201 (got ${createRes.status})`);
  const createdProp = createRes.data && createRes.data.data;
  const createdId = createdProp && createdProp._id;
  assert(createdId && typeof createdId === 'string', `Property persisted in MongoDB with _id: ${createdId}`);

  // 3. READ: Fetch by ID to confirm MongoDB persistence
  const getByIdRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: `/api/properties/${createdId}`,
    method: 'GET'
  });
  assert(getByIdRes.status === 200, `GET /api/properties/${createdId} confirms record exists in MongoDB`);
  assert(
    getByIdRes.data && getByIdRes.data.data && getByIdRes.data.data.title === testPropPayload.title,
    'Persisted property matches title in MongoDB'
  );

  // 4. UPDATE: Update property via PUT /api/properties/:id
  const updatedPayload = {
    pricePerNight: 9500,
    title: 'Verification Suite Test Villa (Updated)'
  };
  const updateRes = await requestHttp(
    {
      host: 'localhost',
      port: 5000,
      path: `/api/properties/${createdId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    },
    updatedPayload
  );
  assert(updateRes.status === 200, `PUT /api/properties/${createdId} updated successfully`);

  // Verify the update in MongoDB
  const verifyUpdateRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: `/api/properties/${createdId}`,
    method: 'GET'
  });
  assert(
    verifyUpdateRes.data && verifyUpdateRes.data.data && verifyUpdateRes.data.data.pricePerNight === 9500,
    'MongoDB reflects updated pricePerNight (9500)'
  );

  // 5. DELETE: Delete property via DELETE /api/properties/:id
  const deleteRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: `/api/properties/${createdId}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  assert(deleteRes.status === 200, `DELETE /api/properties/${createdId} removed successfully`);

  // Verify it is gone from MongoDB
  const verifyDeleteRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: `/api/properties/${createdId}`,
    method: 'GET'
  });
  assert(verifyDeleteRes.status === 404, `GET deleted property returned 404 (confirmed deleted from database)`);

  // Verify initial property count is completely preserved
  const finalPropsRes = await requestHttp({
    host: 'localhost',
    port: 5000,
    path: '/api/properties',
    method: 'GET'
  });
  const finalCount = (finalPropsRes.data && finalPropsRes.data.data) ? finalPropsRes.data.data.length : 0;
  assert(
    finalCount === initialCount,
    `MongoDB Atlas database cleanly restored to original property count (${initialCount})`
  );

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
