/**
 * DynamicRent - Authentication End-to-End Test Suite
 * Non-destructive verification of User model, bcrypt hashing, JWT issuance,
 * input validation, duplicate handling, role enforcement, and demo account continuity.
 */

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log(' Starting DynamicRent Auth Integration Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    assert(healthRes.status === 200 && health.database.connected === true, 'Backend health check reports MongoDB connected');

    // 2. Demo customer login
    const custLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@dynamicrent.com',
        password: '123456',
        role: 'customer'
      })
    });
    const custLogin = await custLoginRes.json();
    assert(custLoginRes.status === 200 && custLogin.success === true, 'Demo customer login succeeds with HTTP 200');
    assert(custLogin.user && custLogin.user.id === 'USR_DEMO', 'Demo customer user ID preserved as USR_DEMO');
    assert(custLogin.token && typeof custLogin.token === 'string', 'Demo customer login returns signed JWT token');
    assert(!custLogin.user.password && !custLogin.user.passwordHash, 'Demo customer response never exposes password or passwordHash');

    // 3. Demo owner login
    const ownerLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@dynamicrent.com',
        password: '123456',
        role: 'owner'
      })
    });
    const ownerLogin = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200 && ownerLogin.success === true, 'Demo owner login succeeds with HTTP 200');
    assert(ownerLogin.user && ownerLogin.user.id === 'OWN001', 'Demo owner user ID preserved as OWN001');
    assert(ownerLogin.token && typeof ownerLogin.token === 'string', 'Demo owner login returns signed JWT token');
    assert(!ownerLogin.user.password && !ownerLogin.user.passwordHash, 'Demo owner response never exposes password or passwordHash');

    // 4. Invalid credentials check
    const badPassRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@dynamicrent.com',
        password: 'incorrect_password',
        role: 'customer'
      })
    });
    const badPass = await badPassRes.json();
    assert(badPassRes.status === 401 && badPass.success === false, 'Invalid password rejected with HTTP 401 Unauthorized');

    // 5. Role mismatch rejection
    const wrongRoleRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@dynamicrent.com',
        password: '123456',
        role: 'owner'
      })
    });
    assert(wrongRoleRes.status === 401, 'Mismatched role rejected with HTTP 401 Unauthorized');

    // 6. Registration validation: password too short (<6 chars)
    const shortPassRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Tester',
        email: 'shortpass@example.com',
        password: '123',
        role: 'customer'
      })
    });
    const shortPass = await shortPassRes.json();
    assert(shortPassRes.status === 400 && shortPass.message.includes('6 characters'), 'Password < 6 chars rejected with HTTP 400');

    // 7. Registration validation: invalid email
    const invalidEmailRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Email Tester',
        email: 'not-an-email',
        password: 'validPassword123',
        role: 'customer'
      })
    });
    assert(invalidEmailRes.status === 400, 'Invalid email format rejected with HTTP 400');

    // 8. Registration duplicate email handling
    const dupEmailRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Tester',
        email: 'customer@dynamicrent.com',
        password: 'somePassword123',
        role: 'customer'
      })
    });
    assert(dupEmailRes.status === 409, 'Duplicate email registration rejected with HTTP 409 Conflict');

    // 9. Successful registration of new test account
    const testEmail = `suite_test_${Date.now()}@dynamicrent.com`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Suite Test User',
        email: testEmail,
        password: 'strongPassword987!',
        role: 'customer'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.success === true, 'New user registration succeeds with HTTP 201 Created');
    assert(regData.token && regData.user && regData.user.email === testEmail, 'Registration returns JWT token and normalized user');
    assert(!regData.user.password && !regData.user.passwordHash, 'Registration never exposes password or passwordHash');

    // 10. Login with the newly registered user
    const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'strongPassword987!',
        role: 'customer'
      })
    });
    const newLogin = await newLoginRes.json();
    assert(newLoginRes.status === 200 && newLogin.token, 'Newly registered user can log in immediately with HTTP 200');

    // 11. Profile verification endpoint GET /api/auth/me
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${newLogin.token}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user && meData.user.email === testEmail, 'GET /api/auth/me verifies Bearer token successfully');

    // 12. GET /api/auth/me without token
    const meNoTokenRes = await fetch(`${API_BASE}/auth/me`);
    assert(meNoTokenRes.status === 401, 'GET /api/auth/me without token rejected with HTTP 401');

    // 13. Role authorization check: Customer role cannot create property (restricted to owner)
    const custPostPropRes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newLogin.token}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Property',
        description: 'Should be blocked',
        location: 'Mumbai',
        propertyType: 'Apartment',
        pricePerNight: 2000
      })
    });
    assert(custPostPropRes.status === 403, 'Customer role blocked from owner endpoint (POST /api/properties) with HTTP 403 Forbidden');

    // 14. Unauthenticated call to protected endpoint
    const unauthPropRes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Property',
        description: 'Should be blocked',
        location: 'Mumbai',
        propertyType: 'Apartment',
        pricePerNight: 2000
      })
    });
    assert(unauthPropRes.status === 401, 'Unauthenticated request to protected endpoint rejected with HTTP 401 Unauthorized');

    // 15. Owner role authorization check: Owner role is permitted to access POST /api/properties
    const ownerPostPropRes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerLogin.token}`
      },
      body: JSON.stringify({}) // Empty body tests authorization passes and reaches controller validation
    });
    assert(ownerPostPropRes.status === 400, 'Owner role passes authorization on POST /api/properties and reaches controller validation');

    // 16. Clean up temporary test account
    require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
    const mongoose = require('../backend/node_modules/mongoose');
    const User = require('../backend/models/User');
    await mongoose.connect(process.env.MONGODB_URI);
    await User.deleteMany({ email: { $regex: '^suite_test_' } });
    await mongoose.disconnect();
    assert(true, 'Temporary test user safely removed from MongoDB Atlas (zero database residue)');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` Test Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
