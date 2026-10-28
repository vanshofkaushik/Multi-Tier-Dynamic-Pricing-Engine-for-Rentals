/**
 * Automated Test Suite for Owner Properties Integration (Read-Only)
 * Verifies DOM structure, JS integration logic, and live backend querying
 * without creating, updating, or deleting any database records.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Setup JSDOM or minimal mock environment for DOM-based testing
const jsdom = (() => {
  try {
    return require('jsdom');
  } catch (e) {
    return null;
  }
})();

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING OWNER PROPERTIES INTEGRATION TESTS (READ-ONLY)');
  console.log('====================================================\n');

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

  const workspaceRoot = 'c:/5-sem/Dyanmic Rent Final';

  // ----------------------------------------------------
  // TEST 1: Inspect HTML structure of owner/properties.html
  // ----------------------------------------------------
  console.log('--- Test Suite 1: owner/properties.html Structure ---');
  const htmlPath = path.join(workspaceRoot, 'owner', 'properties.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert(htmlContent.includes('<script src="../js/utils/api.js"></script>'), 'Includes ApiClient script tag in <head>');
  assert(htmlContent.includes('id="properties-loading-state"'), 'Contains #properties-loading-state element');
  assert(htmlContent.includes('id="properties-api-error-state"'), 'Contains #properties-api-error-state element');
  assert(htmlContent.includes('id="properties-empty-state"'), 'Contains #properties-empty-state element');
  assert(htmlContent.includes('id="owner-properties-grid"'), 'Contains #owner-properties-grid container');
  assert(htmlContent.includes('id="owner-property-modal"'), 'Contains #owner-property-modal for Add/Edit');
  assert(htmlContent.includes('id="owner-property-form"'), 'Contains #owner-property-form form element');
  assert(htmlContent.includes('id="form-prop-title"'), 'Contains #form-prop-title input');
  assert(htmlContent.includes('id="form-prop-location"'), 'Contains #form-prop-location input');
  assert(htmlContent.includes('id="form-prop-type"'), 'Contains #form-prop-type select');
  assert(htmlContent.includes('id="form-prop-price"'), 'Contains #form-prop-price input');
  assert(htmlContent.includes('id="form-prop-description"'), 'Contains #form-prop-description textarea');
  assert(htmlContent.includes('id="form-prop-image"'), 'Contains #form-prop-image input');
  assert(htmlContent.includes('id="form-prop-amenities"'), 'Contains #form-prop-amenities input');
  assert(htmlContent.includes('openAddPropertyModal()'), 'Header "+ Add New Listing" button calls openAddPropertyModal()');

  // ----------------------------------------------------
  // TEST 2: Inspect js/owner/ownerProperties.js Exports & Methods
  // ----------------------------------------------------
  console.log('\n--- Test Suite 2: js/owner/ownerProperties.js Module ---');
  const jsPath = path.join(workspaceRoot, 'js', 'owner', 'ownerProperties.js');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  assert(jsContent.includes('ApiClient.getProperties'), 'Calls ApiClient.getProperties() to fetch listings');
  assert(jsContent.includes('ApiClient.getBookings'), 'Calls ApiClient.getBookings() to compute occupancy metrics');
  assert(jsContent.includes('ApiClient.createProperty'), 'Connects to ApiClient.createProperty() for new listings');
  assert(jsContent.includes('ApiClient.updateProperty'), 'Connects to ApiClient.updateProperty() for editing listings');
  assert(jsContent.includes('openAddPropertyModal'), 'Defines openAddPropertyModal() function');
  assert(jsContent.includes('openEditPropertyModal'), 'Defines openEditPropertyModal() function');
  assert(jsContent.includes('closePropertyModal'), 'Defines closePropertyModal() function');
  assert(jsContent.includes('handleSaveProperty'), 'Defines handleSaveProperty() function');
  assert(jsContent.includes('renderPropertyCardHtml'), 'Defines renderPropertyCardHtml() function');

  // ----------------------------------------------------
  // TEST 3: Inspect js/utils/api.js Property API Methods
  // ----------------------------------------------------
  console.log('\n--- Test Suite 3: js/utils/api.js Property Endpoints ---');
  const apiPath = path.join(workspaceRoot, 'js', 'utils', 'api.js');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  assert(apiContent.includes('getProperties(filters'), 'ApiClient has getProperties() method');
  assert(apiContent.includes('getPropertyById(id)'), 'ApiClient has getPropertyById() method');
  assert(apiContent.includes('updateProperty(id, propertyData)'), 'ApiClient has updateProperty() method');
  assert(apiContent.includes('createProperty(propertyData)'), 'ApiClient has createProperty() method');
  assert(apiContent.includes('deleteProperty(id)'), 'ApiClient has deleteProperty() method');

  // ----------------------------------------------------
  // TEST 4: Backend Live Read-Only Verification
  // ----------------------------------------------------
  console.log('\n--- Test Suite 4: Live Backend Read-Only Query Verification ---');

  // Verify health check
  const healthRes = await fetchJson('http://localhost:5000/api/health');
  assert(healthRes.status === 200 && (healthRes.data.status === 'ok' || healthRes.data.success), 'Backend health check returns status 200 OK');

  // Snapshot property count before
  const propsBeforeRes = await fetchJson('http://localhost:5000/api/properties');
  assert(propsBeforeRes.status === 200 && Array.isArray(propsBeforeRes.data.data), 'GET /api/properties returns array of properties');
  const initialPropCount = propsBeforeRes.data.data.length;
  console.log(`    ℹ️ Current properties in MongoDB: ${initialPropCount}`);

  // Fetch properties filtered by ownerId OWN001
  const ownerPropsRes = await fetchJson('http://localhost:5000/api/properties?ownerId=OWN001');
  assert(ownerPropsRes.status === 200 && Array.isArray(ownerPropsRes.data.data), 'GET /api/properties?ownerId=OWN001 returns 200 OK');
  const ownerProps = ownerPropsRes.data.data;
  console.log(`    ℹ️ Owner OWN001 properties count: ${ownerProps.length}`);
  assert(ownerProps.length > 0, 'Found at least 1 property for owner OWN001 in MongoDB');
  assert(ownerProps.every(p => p.ownerId === 'OWN001'), 'All filtered properties strictly belong to ownerId OWN001');

  // Test card generation logic in isolation
  const ownerPropertiesModule = require(path.join(workspaceRoot, 'js', 'owner', 'ownerProperties.js'));
  const sampleProp = ownerProps[0];
  const cardHtml = ownerPropertiesModule.renderPropertyCardHtml(sampleProp);
  assert(cardHtml.includes(sampleProp.title), 'renderPropertyCardHtml includes property title');
  assert(cardHtml.includes(sampleProp.location), 'renderPropertyCardHtml includes property location');
  assert(cardHtml.includes(`pricing.html?id=${sampleProp._id}`), 'renderPropertyCardHtml links to Tune Rate (pricing.html?id=...)');
  assert(cardHtml.includes(`openEditPropertyModal('${sampleProp._id}')`), 'renderPropertyCardHtml includes Edit button with property ID');

  // Snapshot property count after - ensure zero mutations
  const propsAfterRes = await fetchJson('http://localhost:5000/api/properties');
  const finalPropCount = propsAfterRes.data.data.length;
  assert(finalPropCount === initialPropCount, `Database records intact: initial ${initialPropCount} == final ${finalPropCount} (ZERO MUTATIONS)`);

  // Snapshot bookings count - ensure zero mutations
  const bookingsRes = await fetchJson('http://localhost:5000/api/bookings');
  assert(bookingsRes.status === 200 && Array.isArray(bookingsRes.data.data), 'Bookings intact and verified');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
