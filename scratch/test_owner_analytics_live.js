/**
 * Test script to diagnose and verify js/owner/analytics.js with real backend data
 */

const fs = require('fs');
const path = require('path');

async function test() {
  console.log('=== TESTING OWNER ANALYTICS LIVE BACKEND REPRODUCTION ===');

  // 1. Fetch live data as the browser would
  const ownerRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@dynamicrent.com', password: '123456', role: 'owner' })
  }).then(r => r.json());

  console.log('Authenticated Owner:', ownerRes.user);

  const propsRes = await fetch('http://localhost:5000/api/properties?ownerId=' + ownerRes.user.id).then(r => r.json());
  console.log('Fetched Properties count:', propsRes.data.length);

  const bookingsRes = await fetch('http://localhost:5000/api/bookings').then(r => r.json());
  console.log('Fetched Bookings count:', bookingsRes.data.length);

  // 2. Trace original analytics.js filtering
  const cachedOwnerProperties = propsRes.data;
  const allBookings = bookingsRes.data;

  const ownerPropIds = new Set(cachedOwnerProperties.map(p => p.id || p._id));
  const buggyBookings = allBookings.filter(b => ownerPropIds.has(b.propertyId));

  console.log('\n--- BUG REPRODUCTION ---');
  console.log('Sample booking propertyId:', JSON.stringify(allBookings[0].propertyId));
  console.log('Sample ownerPropId in Set:', Array.from(ownerPropIds)[0]);
  console.log('buggyBookings length:', buggyBookings.length);
  console.log('=> Reason: b.propertyId is an object! Set.has(object) returns false!');

  // 3. Test corrected filtering
  function getBookingPropId(b) {
    if (!b) return '';
    if (b.propertyId && typeof b.propertyId === 'object') {
      return String(b.propertyId.id || b.propertyId._id || '');
    }
    return String(b.propertyId || '');
  }

  const fixedBookings = allBookings.filter(b => ownerPropIds.has(getBookingPropId(b)));
  console.log('\n--- FIXED FILTERING ---');
  console.log('fixedBookings length:', fixedBookings.length);
  console.log('Confirmed bookings count:', fixedBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').length);
  const totalRev = fixedBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  console.log('Total Confirmed Revenue:', totalRev);
}

test().catch(console.error);
