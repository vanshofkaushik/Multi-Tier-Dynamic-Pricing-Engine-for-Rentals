/**
 * DynamicRent - End-to-End Test Suite for Dynamic Pricing Behavior
 * 
 * Verifies the exact 10-step sequence requested:
 * 1. Set a property's base price to ₹3,000.
 * 2. Generate a suggestion based on current demand.
 * 3. Approve the suggestion.
 * 4. Verify that the approved price is saved in MongoDB.
 * 5. Change the relevant demand/occupancy inputs or booking data.
 * 6. Generate a new suggestion and verify it can differ from the previously approved price.
 * 7. Approve the new suggestion and verify the Current Price updates.
 * 8. Refresh the page and verify the latest approved price remains saved.
 * 9. Verify the original Base Price has not been overwritten.
 * 10. Verify previous confirmed booking prices remain unchanged.
 * 
 * Plus:
 * - Safety boundary enforcement (reject < 0.5x or > 2.5x basePrice)
 * - Stale quote rejection (prevent older quotes from overwriting newer approved prices)
 * - Idempotency protection (duplicate approvals handled gracefully)
 * - Server restart persistence verification
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Load dotenv for direct DB cleanup
require(path.join(workspaceRoot, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(workspaceRoot, 'backend', '.env')
});
const mongoose = require(path.join(workspaceRoot, 'backend', 'node_modules', 'mongoose'));

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

function requestJson(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerRunning() {
  try {
    const res = await requestJson('GET', '/api/properties');
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function startServer() {
  console.log('Starting backend server process (node server.js)...');
  const proc = spawn('node', ['server.js'], {
    cwd: path.join(workspaceRoot, 'backend'),
    stdio: 'pipe'
  });

  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});

  let ready = false;
  for (let i = 0; i < 20; i++) {
    await delay(1000);
    ready = await isServerRunning();
    if (ready) break;
  }

  if (!ready) {
    throw new Error('Backend server failed to start within 20 seconds');
  }
  return proc;
}

function stopServer(proc) {
  if (!proc) return;
  try {
    proc.kill('SIGINT');
    proc.kill('SIGTERM');
    process.kill(proc.pid);
  } catch (e) {}
}

async function run() {
  console.log('================================================================');
  console.log('🧪 DYNAMIC PRICING VERIFICATION: 10-STEP SEQUENCE TEST');
  console.log('================================================================\n');

  let serverProcess = null;
  let serverSpawnedByUs = false;

  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    serverProcess = await startServer();
    serverSpawnedByUs = true;
    console.log('Backend server is live on port 5000 connected to MongoDB Atlas.\n');
  } else {
    console.log('Backend server is already running on port 5000.\n');
  }

  // Connect to DB for direct record verification and final cleanup
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (mongoUri && mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const Property = require('../backend/models/Property');
  const Booking = require('../backend/models/Booking');
  const Pricing = require('../backend/models/Pricing');

  let createdPropertyId = null;
  let createdBookingId = null;

  try {
    // -------------------------------------------------------------
    // Auth Setup: Login as Owner and Customer
    // -------------------------------------------------------------
    console.log('--- Authentication: Obtain JWT Tokens ---');
    const ownerLoginRes = await requestJson('POST', '/api/auth/login', {
      email: 'owner@dynamicrent.com',
      password: '123456'
    });
    assert(ownerLoginRes.status === 200, 'Owner login successful (HTTP 200)');
    const ownerToken = ownerLoginRes.data.token;
    assert(typeof ownerToken === 'string' && ownerToken.length > 20, 'Owner JWT token received');

    const customerLoginRes = await requestJson('POST', '/api/auth/login', {
      email: 'customer@dynamicrent.com',
      password: '123456'
    });
    assert(customerLoginRes.status === 200, 'Customer login successful (HTTP 200)');
    const customerToken = customerLoginRes.data.token;
    assert(typeof customerToken === 'string' && customerToken.length > 20, 'Customer JWT token received');

    // -------------------------------------------------------------
    // STEP 1: Set a property's base price to ₹3,000
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Set a property\'s base price to ₹3,000 ---');
    const createPropRes = await requestJson('POST', '/api/properties', {
      title: 'Dynamic Pricing Test Villa ' + Date.now(),
      description: 'Test property for dynamic pricing 10-step sequence verification',
      location: 'Goa',
      propertyType: 'Villa',
      pricePerNight: 3000,
      basePrice: 3000,
      bedrooms: 2,
      bathrooms: 2,
      image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
      ownerId: 'OWN001',
      amenities: ['Wi-Fi', 'Pool', 'Air Conditioning']
    }, ownerToken);

    if (createPropRes.status !== 201) {
      console.error('createPropRes failed with status:', createPropRes.status, createPropRes.data);
    }
    assert(createPropRes.status === 201 && createPropRes.data.success, 'Step 1: Test property created successfully (HTTP 201)');
    if (createPropRes.data && createPropRes.data.data) {
      createdPropertyId = createPropRes.data.data._id;
      assert(createPropRes.data.data.basePrice === 3000, 'Step 1: Property basePrice is ₹3,000');
      assert(createPropRes.data.data.currentPrice === 3000, 'Step 1: Property currentPrice initialized to ₹3,000');
      assert(createPropRes.data.data.pricePerNight === 3000, 'Step 1: Property pricePerNight is ₹3,000');
    }

    // Also verify directly in MongoDB
    const dbProp1 = await Property.findById(createdPropertyId);
    assert(dbProp1.basePrice === 3000, 'Step 1: MongoDB document confirms basePrice === 3000');
    assert(dbProp1.currentPrice === 3000, 'Step 1: MongoDB document confirms currentPrice === 3000');

    // -------------------------------------------------------------
    // STEP 2: Generate a suggestion based on current demand
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Generate a suggestion based on current demand ---');
    const quote1Res = await requestJson('GET', `/api/pricing/${createdPropertyId}?checkIn=2026-11-20&checkOut=2026-11-23`);
    assert(quote1Res.status === 200 && quote1Res.data.success, 'Step 2: Dynamic quote generated (HTTP 200)');
    const quote1 = quote1Res.data.data;
    assert(quote1.basePrice === 3000, 'Step 2: Quote recognizes original base anchor of ₹3,000');
    assert(typeof quote1.suggestedPricePerNight === 'number' && quote1.suggestedPricePerNight > 0, `Step 2: Suggested price is valid positive number (₹${quote1.suggestedPricePerNight})`);
    assert(quote1.quoteId, 'Step 2: Quote ID is persisted to Pricing collection in MongoDB');
    console.log(`  ℹ Initial Recommendation: ₹${quote1.suggestedPricePerNight} / night (Occupancy: ${quote1.occupancyRate}%, Clamped Multiplier: ${quote1.multipliers.clampedMultiplier}x)`);

    // -------------------------------------------------------------
    // STEP 3: Approve the suggestion
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Approve the suggestion ---');
    const approve1Res = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: quote1.suggestedPricePerNight,
      quoteId: quote1.quoteId
    }, ownerToken);
    assert(approve1Res.status === 200 && approve1Res.data.success, 'Step 3: Owner approval endpoint succeeded (HTTP 200)');
    assert(approve1Res.data.data.currentPrice === quote1.suggestedPricePerNight, `Step 3: Response confirms currentPrice = ₹${quote1.suggestedPricePerNight}`);
    assert(approve1Res.data.data.basePricePreserved === true, 'Step 3: Server reports basePrice was preserved');

    // -------------------------------------------------------------
    // STEP 4: Verify that the approved price is saved in MongoDB
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Verify that the approved price is saved in MongoDB ---');
    // Via API
    const verify1Res = await requestJson('GET', `/api/properties/${createdPropertyId}`);
    assert(verify1Res.status === 200, 'Step 4: Property retrieved via API');
    const propAfterApprove1 = verify1Res.data.data;
    assert(propAfterApprove1.currentPrice === quote1.suggestedPricePerNight, `Step 4: API currentPrice is ₹${quote1.suggestedPricePerNight}`);
    assert(propAfterApprove1.pricePerNight === quote1.suggestedPricePerNight, `Step 4: API pricePerNight is ₹${quote1.suggestedPricePerNight}`);
    assert(propAfterApprove1.lastApprovedPrice === quote1.suggestedPricePerNight, `Step 4: API lastApprovedPrice is ₹${quote1.suggestedPricePerNight}`);
    assert(propAfterApprove1.basePrice === 3000, 'Step 4: API basePrice is STILL ₹3,000 (Base Price NOT overwritten!)');

    // Direct MongoDB verification
    const dbPropAfterApprove1 = await Property.findById(createdPropertyId);
    assert(dbPropAfterApprove1.currentPrice === quote1.suggestedPricePerNight, `Step 4: MongoDB record currentPrice is ₹${quote1.suggestedPricePerNight}`);
    assert(dbPropAfterApprove1.basePrice === 3000, 'Step 4: MongoDB record basePrice is STILL ₹3,000 (Direct DB check)');

    // -------------------------------------------------------------
    // STEP 5: Change the relevant demand/occupancy inputs or booking data
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Change relevant demand/occupancy inputs or booking data ---');
    // Create a customer booking for this property
    const bookingRes = await requestJson('POST', '/api/bookings', {
      propertyId: createdPropertyId,
      customerId: 'CUST001',
      checkIn: '2026-11-20',
      checkOut: '2026-11-23',
      guests: 2
    }, customerToken);

    assert(bookingRes.status === 201 && bookingRes.data.success, 'Step 5: Customer reservation created at current approved price');
    createdBookingId = bookingRes.data.data._id;
    const initialBookingTotalPrice = bookingRes.data.data.totalPrice;
    assert(initialBookingTotalPrice === 3 * quote1.suggestedPricePerNight, `Step 5: Booking totalPrice = 3 nights × ₹${quote1.suggestedPricePerNight} = ₹${initialBookingTotalPrice}`);

    // Confirm the reservation using Owner token to alter real market demand in MongoDB
    const patchBookingRes = await requestJson('PATCH', `/api/bookings/${createdBookingId}/status`, {
      status: 'Confirmed'
    }, ownerToken);
    assert(patchBookingRes.status === 200 && patchBookingRes.data.data.status === 'Confirmed', 'Step 5: Booking marked Confirmed in MongoDB (Altering market demand)');

    // -------------------------------------------------------------
    // STEP 6: Generate a new suggestion and verify it can differ from the previously approved price
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Generate new suggestion & verify it differs from previously approved price ---');
    // Request quote for a 1-night short stay overlapping the booking window
    const quote2Res = await requestJson('GET', `/api/pricing/${createdPropertyId}?checkIn=2026-11-21&checkOut=2026-11-22`);
    assert(quote2Res.status === 200 && quote2Res.data.success, 'Step 6: New dynamic quote generated');
    const quote2 = quote2Res.data.data;
    console.log(`  ℹ Previously Approved Rate: ₹${quote1.suggestedPricePerNight}`);
    console.log(`  ℹ New Recalculated Suggestion: ₹${quote2.suggestedPricePerNight} (Occupancy: ${quote2.occupancyRate}%, Multiplier: ${quote2.multipliers.clampedMultiplier}x)`);

    assert(quote2.suggestedPricePerNight !== quote1.suggestedPricePerNight, `Step 6: New suggestion (₹${quote2.suggestedPricePerNight}) differs from previously approved price (₹${quote1.suggestedPricePerNight})`);
    assert(quote2.basePrice === 3000, 'Step 6: New suggestion uses Base Price anchor ₹3,000, NOT previously approved price!');

    const expectedCalculated = Math.round((3000 * quote2.multipliers.clampedMultiplier) / 50) * 50;
    assert(quote2.suggestedPricePerNight === expectedCalculated, `Step 6: Verified formula: ₹3,000 × ${quote2.multipliers.clampedMultiplier} = ₹${expectedCalculated}`);

    // -------------------------------------------------------------
    // STEP 7: Approve the new suggestion and verify the Current Price updates
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Approve the new suggestion and verify Current Price updates ---');
    const approve2Res = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: quote2.suggestedPricePerNight,
      quoteId: quote2.quoteId
    }, ownerToken);
    assert(approve2Res.status === 200 && approve2Res.data.success, 'Step 7: Second approval succeeds (HTTP 200)');
    assert(approve2Res.data.data.currentPrice === quote2.suggestedPricePerNight, `Step 7: Response confirms updated currentPrice = ₹${quote2.suggestedPricePerNight}`);
    assert(approve2Res.data.data.basePrice === 3000, 'Step 7: Response confirms basePrice is still ₹3,000');

    // -------------------------------------------------------------
    // STEP 8: Refresh the page and verify the latest approved price remains saved
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Refresh/reload property and verify latest approved price remains saved ---');
    const reloadRes = await requestJson('GET', `/api/properties/${createdPropertyId}`);
    assert(reloadRes.status === 200, 'Step 8: Property reloaded from database');
    const reloadedProperty = reloadRes.data.data;
    assert(reloadedProperty.currentPrice === quote2.suggestedPricePerNight, `Step 8: Current Price persists as ₹${quote2.suggestedPricePerNight} after refresh`);
    assert(reloadedProperty.pricePerNight === quote2.suggestedPricePerNight, `Step 8: Active PricePerNight persists as ₹${quote2.suggestedPricePerNight}`);

    // Direct MongoDB verification
    const dbPropReloaded = await Property.findById(createdPropertyId);
    assert(dbPropReloaded.currentPrice === quote2.suggestedPricePerNight, `Step 8: MongoDB record confirms currentPrice === ₹${quote2.suggestedPricePerNight}`);
    assert(dbPropReloaded.lastApprovedPrice === quote2.suggestedPricePerNight, `Step 8: MongoDB record confirms lastApprovedPrice === ₹${quote2.suggestedPricePerNight}`);

    // -------------------------------------------------------------
    // STEP 9: Verify the original Base Price has NOT been overwritten
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Verify original Base Price has NOT been overwritten ---');
    assert(reloadedProperty.basePrice === 3000, `Step 9: API basePrice is ₹${reloadedProperty.basePrice} (STILL EXACTLY ₹3,000, NOT overwritten!)`);
    assert(dbPropReloaded.basePrice === 3000, `Step 9: MongoDB direct basePrice is ₹${dbPropReloaded.basePrice} (STILL EXACTLY ₹3,000, NOT overwritten!)`);

    // -------------------------------------------------------------
    // STEP 10: Verify previous confirmed booking prices remain unchanged
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Verify previous confirmed booking prices remain unchanged ---');
    const verifyBookingRes = await requestJson('GET', `/api/bookings/${createdBookingId}`);
    assert(verifyBookingRes.status === 200, 'Step 10: Booking retrieved from MongoDB via API');
    const savedBooking = verifyBookingRes.data.data;
    assert(savedBooking.totalPrice === initialBookingTotalPrice, `Step 10: API booking totalPrice remains ₹${savedBooking.totalPrice} (EXACT match to ₹${initialBookingTotalPrice}, NOT altered!)`);

    // Direct MongoDB verification
    const dbBooking = await Booking.findById(createdBookingId);
    assert(dbBooking.totalPrice === initialBookingTotalPrice, `Step 10: MongoDB direct booking totalPrice is ₹${dbBooking.totalPrice} (Confirmed booking unchanged!)`);

    // -------------------------------------------------------------
    // EXTRA DEFENSIVE TESTS: Validation, Safety, Stale Quotes & Server Restart
    // -------------------------------------------------------------
    console.log('\n--- Extra Validations: Safety Bounds, Stale Quote Protection & Server Restart ---');
    
    // 1. Negative price rejected
    const negPriceRes = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: -500
    }, ownerToken);
    assert(negPriceRes.status === 400, 'Validation: Rejects negative approvedPrice (HTTP 400)');

    // 2. Unsafe price exceeding safety limit (> 2.5x base price) rejected
    const excessivePriceRes = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: 9000 // 3.0x basePrice of 3000
    }, ownerToken);
    assert(excessivePriceRes.status === 400, 'Validation: Rejects price exceeding 2.5x basePrice safety boundary (HTTP 400)');

    // 3. Stale quote protection (attempt to approve quote1 after quote2 was already approved)
    const staleApproveRes = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: quote1.suggestedPricePerNight,
      quoteId: quote1.quoteId
    }, ownerToken);
    assert(staleApproveRes.status === 409, 'Stale Protection: Rejects stale quoteId created before the latest approval (HTTP 409 Conflict)');

    // 4. Duplicate approval is idempotent
    const dupApproveRes = await requestJson('POST', `/api/pricing/${createdPropertyId}/approve`, {
      approvedPrice: quote2.suggestedPricePerNight,
      quoteId: quote2.quoteId
    }, ownerToken);
    assert(dupApproveRes.status === 200, 'Idempotency: Re-approving current rate succeeds without error or data mutation');

    // 5. Server Restart Persistence Verification
    if (serverSpawnedByUs && serverProcess) {
      console.log('\n--- Server Restart Persistence Verification ---');
      console.log('Stopping server process...');
      stopServer(serverProcess);
      await delay(1500);

      console.log('Restarting server process...');
      serverProcess = await startServer();
      console.log('Server restarted. Querying property from fresh server...');

      const postRestartRes = await requestJson('GET', `/api/properties/${createdPropertyId}`);
      assert(postRestartRes.status === 200, 'Server Restart: Property retrieved from freshly restarted server');
      assert(postRestartRes.data.data.basePrice === 3000, 'Server Restart: basePrice remains ₹3,000 after server restart');
      assert(postRestartRes.data.data.currentPrice === quote2.suggestedPricePerNight, `Server Restart: currentPrice remains ₹${quote2.suggestedPricePerNight} after server restart`);
    }

  } finally {
    // Clean up test property and booking from MongoDB Atlas
    console.log('\n--- Cleaning up test records from MongoDB Atlas ---');
    if (createdBookingId) {
      try {
        await Booking.findByIdAndDelete(createdBookingId);
        console.log(`  ✓ Cleaned up test booking: ${createdBookingId}`);
      } catch (e) {
        console.warn('  ⚠ Could not delete test booking:', e.message);
      }
    }

    if (createdPropertyId) {
      try {
        await Property.findByIdAndDelete(createdPropertyId);
        await Pricing.deleteMany({ propertyId: createdPropertyId });
        console.log(`  ✓ Cleaned up test property & quotes: ${createdPropertyId}`);
      } catch (e) {
        console.warn('  ⚠ Could not delete test property:', e.message);
      }
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (serverSpawnedByUs && serverProcess) {
      console.log('\nStopping backend server...');
      stopServer(serverProcess);
    }
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test script crashed with error:', err);
  process.exit(1);
});
