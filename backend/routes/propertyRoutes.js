const express = require('express');
const router = express.Router();
const {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
} = require('../controllers/propertyController');

const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * Property Routes
 * Base route: /api/properties
 */

// Route: /api/properties
// GET is public for browsing; POST is protected for owners
router.route('/')
  .get(getAllProperties)
  .post(protect, authorize('owner'), createProperty);

// Route: /api/properties/:id
// GET is public; PUT and DELETE are protected for owners
router.route('/:id')
  .get(getPropertyById)
  .put(protect, authorize('owner'), updateProperty)
  .delete(protect, authorize('owner'), deleteProperty);

module.exports = router;
