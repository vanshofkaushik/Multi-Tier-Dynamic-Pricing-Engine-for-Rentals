const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Ensures baseline demo accounts exist in MongoDB Atlas with secure bcrypt hashes.
 * Preserves existing 'USR_DEMO' and 'OWN001' IDs so demo properties and bookings remain intact.
 */
const seedDemoUsers = async () => {
  try {
    const demoAccounts = [
      {
        name: 'Demo Customer',
        email: 'customer@dynamicrent.com',
        plainPassword: '123456',
        role: 'customer',
        customId: 'USR_DEMO'
      },
      {
        name: 'Demo Owner',
        email: 'owner@dynamicrent.com',
        plainPassword: '123456',
        role: 'owner',
        customId: 'OWN001'
      }
    ];

    for (const demo of demoAccounts) {
      const existing = await User.findOne({ email: demo.email });
      if (!existing) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(demo.plainPassword, salt);

        await User.create({
          name: demo.name,
          email: demo.email,
          passwordHash,
          role: demo.role,
          customId: demo.customId
        });
        console.log(`[DemoSeed] Created secure demo account: ${demo.email} (${demo.role})`);
      }
    }
  } catch (err) {
    console.error('[DemoSeed] Warning: Failed to verify or seed demo accounts:', err.message);
  }
};

module.exports = seedDemoUsers;
