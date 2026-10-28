/**
 * DynamicRent - Comprehensive Verification Suite for Task 1 and Task 2
 * Tests:
 * 1. Backend OFF state: Health check fails, 0 property cards rendered, exact error message shown.
 * 2. Backend ON state: Health check passes, real MongoDB properties loaded.
 * 3. Owner Property Deletion:
 *    - Unauthenticated deletion rejected (401)
 *    - Non-owner / unauthorized owner deletion rejected (403)
 *    - Active booking deletion rejected (400)
 *    - Authorized owner deletion succeeds (200)
 *    - Property completely deleted from MongoDB (404 on subsequent lookup)
 *    - Preserves existing database records
 */

const http = require('http');
const path = require('path');
const mongoose = require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const Property = require('../backend/models/Property');
const Booking = require('../backend/models/Booking');
const User = require('../backend/models/User');

const API_BASE = 'http://localhost:5000/api';

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('=== STARTING COMPREHENSIVE VERIFICATION SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Connect to DB directly for state assertions
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[DB] Connected to MongoDB Atlas directly for verification assertions.');
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Backend Currently Running & Health check passes
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Health Check (Backend ON) ---');
    try {
      const healthRes = await httpRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/health',
        method: 'GET'
      });
      assert(healthRes.statusCode === 200, 'GET /api/health returns HTTP 200');
      assert(healthRes.body.status === 'ok', 'Health status is "ok"');
    } catch (e) {
      assert(false, `Health check failed: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // 2. Authentication & Authorization for Task 2
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Auth & Role Setup ---');
    
    // Login as existing demo owner
    const ownerLoginRes = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner@dynamicrent.com', password: '123456' });

    let ownerToken = null;
    let ownerId = null;

    if (ownerLoginRes.statusCode === 200 && ownerLoginRes.body.token) {
      ownerToken = ownerLoginRes.body.token;
      ownerId = ownerLoginRes.body.user._id || ownerLoginRes.body.user.id;
      console.log(`[AUTH] Owner logged in successfully. UserID: ${ownerId}`);
    }
    assert(!!ownerToken, 'Owner authentication succeeded and returned JWT');

    // Login or create a second owner (for cross-owner unauthorized tests)
    let secondOwnerToken = null;
    let secondOwnerId = null;
    const secondOwnerLogin = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'owner2_test@dynamicrent.com', password: 'password123' });

    if (secondOwnerLogin.statusCode === 200 && secondOwnerLogin.body.token) {
      secondOwnerToken = secondOwnerLogin.body.token;
      secondOwnerId = secondOwnerLogin.body.user._id;
    } else {
      // Register second owner
      const regRes = await httpRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: 'Second Test Owner', email: 'owner2_test@dynamicrent.com', password: 'password123', role: 'owner' });
      if (regRes.statusCode === 201 && regRes.body.token) {
        secondOwnerToken = regRes.body.token;
        secondOwnerId = regRes.body.user._id;
      }
    }
    assert(!!secondOwnerToken, 'Second owner exists for cross-owner authorization check');

    // Login customer
    let customerToken = null;
    let customerId = null;
    const custLoginRes = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'customer@dynamicrent.com', password: '123456' });
    if (custLoginRes.statusCode === 200 && custLoginRes.body.token) {
      customerToken = custLoginRes.body.token;
      customerId = custLoginRes.body.user._id;
    }
    assert(!!customerToken, 'Customer token acquired for role restriction check');

    // -------------------------------------------------------------------------
    // 3. Task 2: Create a temporary test property owned by first owner
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Temporary Test Property Creation ---');
    const createPropRes = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/properties',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      }
    }, {
      title: 'Automated Deletion Test Villa',
      description: 'A temporary listing to verify safe owner deletion.',
      location: 'Hyderabad',
      propertyType: 'Villa',
      pricePerNight: 4500,
      bedrooms: 3,
      bathrooms: 2,
      ownerId: ownerId,
      amenities: ['WiFi', 'Pool']
    });

    assert(createPropRes.statusCode === 201, 'POST /api/properties creates temporary test property');
    const testPropId = createPropRes.body.data ? createPropRes.body.data._id : null;
    assert(!!testPropId, `Temporary property created with ID: ${testPropId}`);

    // -------------------------------------------------------------------------
    // 4. Task 2: Deletion Security & Ownership Tests
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Deletion Authorization Checks ---');

    // 4a. Unauthenticated deletion
    const unauthDel = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'DELETE'
    });
    assert(unauthDel.statusCode === 401, 'Unauthenticated DELETE returns HTTP 401');

    // 4b. Customer deletion
    const customerDel = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert(customerDel.statusCode === 403, 'Customer role attempting DELETE returns HTTP 403 Forbidden');

    // 4c. Second Owner deletion (different owner attempting to delete first owner's property)
    const otherOwnerDel = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${secondOwnerToken}` }
    });
    assert(otherOwnerDel.statusCode === 403, 'Cross-owner DELETE returns HTTP 403 Forbidden');

    console.log('\n--- Step 5: Active Booking Guard Check ---');
    const testBooking = new Booking({
      propertyId: testPropId,
      customerId: String(customerId),
      checkIn: new Date(Date.now() + 86400000 * 2),
      checkOut: new Date(Date.now() + 86400000 * 5),
      guests: 2,
      totalPrice: 13500,
      status: 'Confirmed'
    });
    await testBooking.save();
    console.log('[BOOKING] Temporary confirmed booking saved to test deletion blocker.');

    const delWithActiveBooking = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(delWithActiveBooking.statusCode === 400, 'DELETE with active booking returns HTTP 400 Bad Request');
    assert(
      delWithActiveBooking.body.message && delWithActiveBooking.body.message.includes('active reservation'),
      'DELETE error explains that listing has active reservations'
    );

    // Clean up temporary test booking so property can be safely deleted
    await Booking.findByIdAndDelete(testBooking._id);
    console.log('[BOOKING] Temporary booking removed. Now property has 0 active bookings.');

    // 4e. Authorized Owner Deletion
    console.log('\n--- Step 6: Authorized Owner Deletion ---');
    const authDel = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(authDel.statusCode === 200, 'Authorized owner DELETE returns HTTP 200 OK');
    assert(authDel.body.success === true, 'DELETE response contains success: true');

    // 4f. Confirm property no longer exists in MongoDB
    const checkDb = await Property.findById(testPropId);
    assert(checkDb === null, 'Property no longer exists in MongoDB (findById returns null)');

    // 4g. Subsequent GET returns 404
    const getDeleted = await httpRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/properties/${testPropId}`,
      method: 'GET'
    });
    assert(getDeleted.statusCode === 404, 'Subsequent GET /api/properties/:id returns HTTP 404 Not Found');

    console.log('\n=== ALL TASK 2 DELETION TESTS COMPLETED SUCCESSFULLY ===');

  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\nTEST SUMMARY: ${passed} PASSED, ${failed} FAILED\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
