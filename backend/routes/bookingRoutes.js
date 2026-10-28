const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingStatus
} = require('../controllers/bookingController');

const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * Booking Routes
 * Base route: /api/bookings
 */

// Route: /api/bookings
// POST is protected for customers; GET is available for fetching reservations
router.route('/')
  .post(protect, authorize('customer'), createBooking)
  .get(getAllBookings);

// Route: /api/bookings/:id
router.route('/:id')
  .get(getBookingById);

// Route: /api/bookings/:id/status
// Updating booking status is protected for property owners
router.route('/:id/status')
  .patch(protect, authorize('owner'), updateBookingStatus);

module.exports = router;
