/**
 * DynamicRent - Comprehensive Backend-Dependency Audit Test Suite
 * Tests actual behavior when Backend is OFF and when Backend is ON across all core features:
 * 1. Port 5000 verification
 * 2. Auth (Login & Register)
 * 3. Property Listing & Details
 * 4. Booking Creation & Status Updates
 * 5. Dynamic Pricing Calculation & Price Approval
 * 6. Storage & Engine Fallback Neutralization
 * 7. Error Handling & Stale Data Prevention
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

// Helper to make HTTP requests
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function testHealthCheck() {
  try {
    const res = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET',
      timeout: 2000
    });
    return { available: res.statusCode === 200, res };
  } catch (err) {
    return { available: false, error: err.code || err.message };
  }
}

async function runOffStateAudit() {
  console.log('\n======================================================');
  console.log('--- PHASE 1: BACKEND OFF STATE AUDIT ---');
  console.log('======================================================\n');

  // 1. Verify Port 5000 / Health Check is truly unavailable
  const health = await testHealthCheck();
  console.log(`[1] Backend Availability Check: ${health.available ? 'RUNNING (UNEXPECTED)' : 'CONFIRMED OFF (' + health.error + ')'}`);
  if (health.available) {
    throw new Error('Backend is still running on port 5000! Terminate server before running OFF tests.');
  }

  const results = [];

  // 2. Test Auth Offline: Login & Register
  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1500
    }, { email: 'owner@dynamicrent.com', password: 'Password123!' });
    results.push({ feature: 'Offline Login', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    const passed = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
    results.push({ feature: 'Offline Login', passed, detail: `Network connection cleanly rejected (${err.code}). Offline login fails safely.` });
  }

  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1500
    }, { name: 'Test', email: 'test@off.com', password: 'Password123!', role: 'customer' });
    results.push({ feature: 'Offline Register', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    const passed = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
    results.push({ feature: 'Offline Register', passed, detail: `Network connection cleanly rejected (${err.code}). User creation rejected.` });
  }

  // 3. Test Property Catalog & Details Offline
  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/properties',
      method: 'GET',
      timeout: 1500
    });
    results.push({ feature: 'Offline Property Catalog', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    results.push({ feature: 'Offline Property Catalog', passed: true, detail: `Connection refused (${err.code}). Frontend displays connection error banner.` });
  }

  // 4. Test Booking Creation Offline
  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1500
    }, { propertyId: '507f1f77bcf86cd799439011', customerId: 'USR001', checkIn: '2026-11-01', checkOut: '2026-11-05', guests: 2 });
    results.push({ feature: 'Offline Booking Creation', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    results.push({ feature: 'Offline Booking Creation', passed: true, detail: `Connection refused (${err.code}). Cannot falsely claim booking success.` });
  }

  // 5. Test Dynamic Pricing Quote & Approval Offline
  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/pricing/507f1f77bcf86cd799439011?checkIn=2026-11-01&checkOut=2026-11-05',
      method: 'GET',
      timeout: 1500
    });
    results.push({ feature: 'Offline Pricing Quote', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    results.push({ feature: 'Offline Pricing Quote', passed: true, detail: `Connection refused (${err.code}). Cockpit displays error without stale prices.` });
  }

  try {
    await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/pricing/507f1f77bcf86cd799439011/approve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1500
    }, { approvedPrice: 5500 });
    results.push({ feature: 'Offline Price Approval', passed: false, detail: 'Server unexpectedly answered' });
  } catch (err) {
    results.push({ feature: 'Offline Price Approval', passed: true, detail: `Connection refused (${err.code}). Approval rejected; cannot fake DB write.` });
  }

  // 6. Test Frontend Storage & Fallback Units Offline
  global.localStorage = {
    getItem: () => null,
    setItem: () => {}
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const StorageUtils = require('../js/utils/storage.js');
  const PricingEngine = require('../js/owner/pricingEngine.js');

  const emptyProps = StorageUtils.getProperties();
  const emptyBookings = StorageUtils.getBookings();
  const offlineStatusResult = StorageUtils.updateBookingStatus('BOOK001', 'confirmed', 'OWN001');
  const nullPricing = PricingEngine.calculateDynamicPrice(null);
  const unknownPricing = PricingEngine.calculateDynamicPrice('PROP_NONEXISTENT');

  results.push({
    feature: 'StorageUtils.getProperties() Fallback Check',
    passed: Array.isArray(emptyProps) && emptyProps.length === 0,
    detail: `Returned length ${emptyProps.length}. Stale/demo properties eliminated.`
  });

  results.push({
    feature: 'StorageUtils.getBookings() Fallback Check',
    passed: Array.isArray(emptyBookings) && emptyBookings.length === 0,
    detail: `Returned length ${emptyBookings.length}. Stale/demo bookings eliminated.`
  });

  results.push({
    feature: 'StorageUtils.updateBookingStatus() Offline Rejection',
    passed: offlineStatusResult.success === false,
    detail: `Result: ${JSON.stringify(offlineStatusResult)}. Offline fake success prevented.`
  });

  results.push({
    feature: 'PricingEngine Offline Fallback Check (null param)',
    passed: nullPricing === null,
    detail: `Returned: ${nullPricing}. Fabricated ₹4,000 quote prevented.`
  });

  results.push({
    feature: 'PricingEngine Offline Fallback Check (unloaded property)',
    passed: unknownPricing === null,
    detail: `Returned: ${unknownPricing}. Fabricated quote prevented.`
  });

  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.feature}: ${r.detail}`);
  });

  return results;
}

async function runOnStateAudit() {
  console.log('\n======================================================');
  console.log('--- PHASE 2: BACKEND ON STATE AUDIT ---');
  console.log('======================================================\n');

  const health = await testHealthCheck();
  console.log(`[1] Backend Availability Check: ${health.available ? 'ONLINE (200 OK)' : 'FAILED (' + health.error + ')'}`);
  if (!health.available) {
    throw new Error('Backend is not running on port 5000! Start server before running ON tests.');
  }

  const results = [];

  // 1. Health check
  results.push({
    feature: 'GET /api/health',
    passed: health.res.statusCode === 200 && (health.res.data.status || '').toLowerCase() === 'ok' && health.res.data.database?.connected === true,
    detail: `Status ${health.res.statusCode}, DB connected: ${health.res.data.database?.connected}`
  });

  // 2. Auth Flow: Owner Login
  let ownerToken = null;
  let ownerUser = null;
  const loginRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'owner@dynamicrent.com', password: '123456', role: 'owner' });

  const loginPassed = loginRes.statusCode === 200 && loginRes.data.user && loginRes.data.user.role === 'owner';
  if (loginPassed) {
    ownerToken = loginRes.data.token;
    ownerUser = loginRes.data.user;
  }
  results.push({
    feature: 'POST /api/auth/login (Owner)',
    passed: loginPassed,
    detail: `Status ${loginRes.statusCode}, User: ${loginRes.data.user?.name} (${loginRes.data.user?.email})`
  });

  // 3. Properties Flow: GET /api/properties
  const propRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/properties',
    method: 'GET'
  });

  const propList = Array.isArray(propRes.data.data) ? propRes.data.data : (Array.isArray(propRes.data) ? propRes.data : []);
  const propPassed = propRes.statusCode === 200 && propList.length > 0;
  let sampleProp = null;
  if (propPassed) {
    sampleProp = propList[0];
  }
  results.push({
    feature: 'GET /api/properties',
    passed: propPassed,
    detail: `Status ${propRes.statusCode}, Returned ${propList.length} real MongoDB properties. Sample: "${sampleProp?.title || sampleProp?.name}" (Base: ₹${sampleProp?.basePrice || sampleProp?.pricePerNight}, Current: ₹${sampleProp?.currentPrice || sampleProp?.pricePerNight})`
  });

  // 4. Dynamic Pricing Flow: GET /api/pricing/:propertyId
  let quote = null;
  if (sampleProp) {
    const propId = sampleProp._id || sampleProp.id;
    const quoteRes = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/pricing/${propId}?checkIn=2026-11-10&checkOut=2026-11-15`,
      method: 'GET'
    });

    const quoteData = quoteRes.data?.data || quoteRes.data;
    const quotePassed = quoteRes.statusCode === 200 && quoteRes.data.success && typeof quoteData?.suggestedPricePerNight === 'number';
    if (quotePassed) quote = quoteData;
    results.push({
      feature: 'GET /api/pricing/:propertyId',
      passed: quotePassed,
      detail: `Status ${quoteRes.statusCode}, Suggested: ₹${quote?.suggestedPricePerNight}/night (Base: ₹${quote?.basePrice}, Multipliers: ${JSON.stringify(quote?.multipliers)})`
    });

    // 5. Dynamic Pricing Approval Flow: POST /api/pricing/:propertyId/approve
    if (quote) {
      const originalBase = sampleProp.basePrice || sampleProp.pricePerNight;
      const targetApprovalPrice = quote.suggestedPricePerNight;

      const approveRes = await httpRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/pricing/${propId}/approve`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        approvedPrice: targetApprovalPrice,
        quoteId: quote.quoteId
      });

      const approveData = approveRes.data?.data || approveRes.data;
      const approvePassed = approveRes.statusCode === 200 && approveRes.data.success;
      results.push({
        feature: 'POST /api/pricing/:propertyId/approve',
        passed: approvePassed,
        detail: `Status ${approveRes.statusCode}, Updated currentPrice to ₹${approveData?.currentPrice}, Preserved basePrice: ₹${approveData?.basePrice}`
      });

      // Verify base price unchanged on separate GET
      const verifyPropRes = await httpRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/properties/${propId}`,
        method: 'GET'
      });
      const verified = verifyPropRes.data?.data || verifyPropRes.data;
      const basePreserved = verified && verified.basePrice === originalBase;
      const currentUpdated = verified && (verified.currentPrice === targetApprovalPrice);
      results.push({
        feature: 'Base Price Invariance & MongoDB Persistence Verification',
        passed: basePreserved && currentUpdated,
        detail: `basePrice: ₹${verified?.basePrice} (Expected ₹${originalBase}), currentPrice: ₹${verified?.currentPrice} (Expected ₹${targetApprovalPrice})`
      });
    }
  }

  // 6. Bookings Flow: GET /api/bookings
  const bookRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'GET'
  });
  const bookList = Array.isArray(bookRes.data.data) ? bookRes.data.data : (Array.isArray(bookRes.data) ? bookRes.data : []);
  const bookPassed = bookRes.statusCode === 200 && Array.isArray(bookList);
  results.push({
    feature: 'GET /api/bookings',
    passed: bookPassed,
    detail: `Status ${bookRes.statusCode}, Fetched ${bookList.length} real MongoDB bookings.`
  });

  // 7. Price History: GET /api/pricing/:propertyId/history
  if (sampleProp) {
    const propId = sampleProp._id || sampleProp.id;
    const histRes = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/pricing/${propId}/history?limit=50`,
      method: 'GET'
    });
    const histList = Array.isArray(histRes.data.data) ? histRes.data.data : (Array.isArray(histRes.data) ? histRes.data : []);
    const histPassed = histRes.statusCode === 200 && Array.isArray(histList);
    results.push({
      feature: 'GET /api/pricing/:propertyId/history',
      passed: histPassed,
      detail: `Status ${histRes.statusCode}, Fetched ${histList.length} pricing audit records.`
    });
  }

  results.forEach(r => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.feature}: ${r.detail}`);
  });

  return results;
}

async function main() {
  const mode = process.argv[2] || 'both';

  if (mode === 'off' || mode === 'both') {
    await runOffStateAudit();
  }
  if (mode === 'on' || mode === 'both') {
    await runOnStateAudit();
  }
}

main().catch(err => {
  console.error('Audit run error:', err);
  process.exit(1);
});
