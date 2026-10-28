const express = require('express');
const router = express.Router();
const {
  calculateQuote,
  getPricingHistory,
  approvePrice
} = require('../controllers/pricingController');

const { optionalProtect } = require('../middleware/authMiddleware');

/**
 * Dynamic Pricing Routes
 * Base route: /api/pricing
 */

// Route: GET /api/pricing/:propertyId/history
router.get('/:propertyId/history', getPricingHistory);

// Route: POST /api/pricing/:propertyId/approve
router.post('/:propertyId/approve', optionalProtect, approvePrice);

// Route: GET /api/pricing/:propertyId?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
router.get('/:propertyId', calculateQuote);

module.exports = router;
