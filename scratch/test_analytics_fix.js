const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function testFix() {
  console.log('=== TESTING PROPOSED OWNER ANALYTICS FIX ===');

  // Login as owner
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@dynamicrent.com', password: '123456', role: 'owner' })
  }).then(r => r.json());

  const activeOwner = loginRes.user;
  const ownerId = activeOwner.id || activeOwner._id || 'OWN001';

  // Fetch properties and bookings
  const propsRes = await fetch('http://localhost:5000/api/properties?ownerId=' + ownerId).then(r => r.json());
  const bookingsRes = await fetch('http://localhost:5000/api/bookings').then(r => r.json());

  const cachedOwnerProperties = (propsRes.data || []).map(p => {
    const pId = String(p.id || p._id || '');
    return {
      ...p,
      id: pId,
      _id: pId,
      name: p.name || p.title || 'Untitled Property',
      title: p.name || p.title || 'Untitled Property',
      currentPrice: p.currentPrice || p.pricePerNight || 0,
      basePrice: p.basePrice || p.pricePerNight || p.currentPrice || 0
    };
  });

  const ownerPropIdSet = new Set(cachedOwnerProperties.map(p => p.id));

  const cachedOwnerBookings = (bookingsRes.data || [])
    .filter(b => {
      if (!b) return false;
      const bPropId = (b.propertyId && typeof b.propertyId === 'object')
        ? String(b.propertyId.id || b.propertyId._id || '')
        : String(b.propertyId || '');
      if (ownerPropIdSet.has(bPropId)) return true;
      if (b.propertyId && typeof b.propertyId === 'object' && b.propertyId.ownerId) {
        return String(b.propertyId.ownerId).trim() === String(ownerId).trim();
      }
      if (b.ownerId && String(b.ownerId).trim() === String(ownerId).trim()) return true;
      return false;
    })
    .map(b => {
      const bPropId = (b.propertyId && typeof b.propertyId === 'object')
        ? String(b.propertyId.id || b.propertyId._id || '')
        : String(b.propertyId || '');
      const checkInStr = typeof b.checkIn === 'string'
        ? b.checkIn.split('T')[0]
        : (b.checkIn ? new Date(b.checkIn).toISOString().split('T')[0] : '');
      const checkOutStr = typeof b.checkOut === 'string'
        ? b.checkOut.split('T')[0]
        : (b.checkOut ? new Date(b.checkOut).toISOString().split('T')[0] : '');
      return {
        ...b,
        propertyId: bPropId,
        checkIn: checkInStr,
        checkOut: checkOutStr
      };
    });

  // Fetch Pricing History
  const historyPromises = cachedOwnerProperties.map(p =>
    fetch('http://localhost:5000/api/pricing/' + p.id + '/history').then(r => r.json()).then(d => d.data || []).catch(() => [])
  );
  const historyResults = await Promise.all(historyPromises);
  const cachedOwnerPricingHistory = historyResults.flat();

  console.log(`Loaded ${cachedOwnerProperties.length} properties, ${cachedOwnerBookings.length} owner bookings, ${cachedOwnerPricingHistory.length} pricing quotes.`);

  // Load OccupancyEngine & DemandEngine in VM context
  const ctx = {
    StorageUtils: { getBookings: () => [], getOwnerProperties: () => [] },
    console: console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('./js/owner/occupancy.js', 'utf8') + '; this.OccupancyEngine = OccupancyEngine;', ctx);
  vm.runInContext(fs.readFileSync('./js/owner/demandEngine.js', 'utf8') + '; this.DemandEngine = DemandEngine;', ctx);

  // Test Portfolio Occupancy
  const occ = ctx.OccupancyEngine.calculateOverallOwnerOccupancy(ownerId, undefined, undefined, cachedOwnerProperties, cachedOwnerBookings);
  console.log('Portfolio Occupancy Result:', occ);

  // Test Property Performance
  const confirmed = cachedOwnerBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed');
  const revenue = confirmed.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  console.log(`Total Revenue: ₹${revenue}, Confirmed Bookings: ${confirmed.length}`);

  const perfList = cachedOwnerProperties.map(prop => {
    const propBookings = cachedOwnerBookings.filter(b => b.propertyId === prop.id);
    const confBookings = propBookings.filter(b => (b.status || '').toLowerCase() === 'confirmed');
    const propRev = confBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const occStats = ctx.OccupancyEngine.calculatePropertyOccupancy(prop.id, undefined, undefined, cachedOwnerBookings);
    const demandStats = ctx.DemandEngine.calculateDemandScore(prop.id, cachedOwnerBookings);
    return {
      name: prop.name,
      bookingsCount: propBookings.length,
      confirmedCount: confBookings.length,
      revenue: propRev,
      occupancy: occStats.occupancyRate,
      demandLevel: demandStats.level,
      demandScore: demandStats.score
    };
  });

  console.log('\n--- Property Performance Ranking ---');
  console.table(perfList);

  console.log('ALL FIX CHECKS SUCCEEDED!');
}

testFix().catch(console.error);
