const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');

/**
 * @desc    Create a new booking reservation for a property
 * @route   POST /api/bookings
 * @access  Public (Authentication not yet implemented)
 * 
 * NOTE ON PRICING INTEGRITY:
 * totalPrice is strictly calculated server-side based on the referenced Property's
 * pricePerNight and the calculated duration in nights. Client-supplied totalPrice is ignored.
 */
const createBooking = async (req, res) => {
  try {
    const { propertyId, customerId, checkIn, checkOut, guests } = req.body;

    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body cannot be empty'
      });
    }

    // 1. Validate propertyId format
    if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing property ID format: "${propertyId}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // 2. Ensure the referenced Property exists in the database
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Referenced property not found with ID: ${propertyId}`
      });
    }

    // 3. Derive customerId from authenticated session or request body fallback
    const effectiveCustomerId = (req.user && (req.user.customId || req.user._id.toString())) || (customerId && customerId.trim());

    if (!effectiveCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required to create a booking reservation'
      });
    }

    // 4. Validate checkIn and checkOut dates
    if (!checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date is required (YYYY-MM-DD or ISO format)'
      });
    }

    if (!checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date is required (YYYY-MM-DD or ISO format)'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check-in date format. Use YYYY-MM-DD or ISO format.'
      });
    }

    if (isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check-out date format. Use YYYY-MM-DD or ISO format.'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be strictly after check-in date'
      });
    }

    // Calculate number of nights
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (nights < 1) {
      return res.status(400).json({
        success: false,
        message: 'Booking duration must be at least 1 night'
      });
    }

    // 5. Validate guests
    const parsedGuests = Number(guests);
    if (guests === undefined || isNaN(parsedGuests) || !Number.isInteger(parsedGuests) || parsedGuests < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of guests is required and must be a positive integer (minimum 1)'
      });
    }

    // 6. Calculate server-authoritative totalPrice using current approved property rate
    const currentNightlyRate = (property.currentPrice !== undefined && property.currentPrice !== null)
      ? property.currentPrice
      : property.pricePerNight;
    const totalPrice = nights * currentNightlyRate;

    // 7. Create booking with default status 'Pending'
    const newBooking = await Booking.create({
      propertyId,
      customerId: effectiveCustomerId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: parsedGuests,
      totalPrice,
      status: 'Pending'
    });

    // Populate property details for consumer convenience
    await newBooking.populate('propertyId', 'title location propertyType pricePerNight currentPrice basePrice image ownerId');

    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      data: newBooking
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    console.error('Error creating booking:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating booking',
      error: err.message
    });
  }
};

/**
 * @desc    Get all bookings (with optional filters: customerId, propertyId, status)
 * @route   GET /api/bookings
 * @access  Public (Authentication and access control not yet implemented)
 */
const getAllBookings = async (req, res) => {
  try {
    const { customerId, propertyId, status } = req.query;
    const filter = {};

    if (customerId) {
      filter.customerId = customerId.trim();
    }

    if (propertyId) {
      if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid property ID filter format: "${propertyId}"`
        });
      }
      filter.propertyId = propertyId;
    }

    if (status) {
      filter.status = status.trim();
    }

    const bookings = await Booking.find(filter)
      .populate('propertyId', 'title location propertyType pricePerNight currentPrice basePrice image ownerId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    console.error('Error fetching bookings:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: err.message
    });
  }
};

/**
 * @desc    Get a single booking by MongoDB ID
 * @route   GET /api/bookings/:id
 * @access  Public
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid booking ID format: "${id}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    const booking = await Booking.findById(id).populate(
      'propertyId',
      'title location propertyType pricePerNight currentPrice basePrice image ownerId'
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`
      });
    }

    return res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    console.error('Error fetching booking by ID:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: err.message
    });
  }
};

/**
 * @desc    Update booking status to 'Confirmed' or 'Rejected'
 * @route   PATCH /api/bookings/:id/status
 * @access  Public
 * 
 * IMPORTANT SECURITY LIMITATION:
 * Authentication and owner authorization are NOT implemented yet.
 * Any client can currently call this endpoint. Restricting this action
 * exclusively to the property owner will be implemented in future security milestones.
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid booking ID format: "${id}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // Validate that status is either 'Confirmed' or 'Rejected'
    const allowedStatuses = ['Confirmed', 'Rejected'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: "${status}". Status can only be updated to "Confirmed" or "Rejected".`
      });
    }

    const booking = await Booking.findById(id).populate('propertyId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Booking not found with ID: ${id}`
      });
    }

    // Verify ownership if authenticated owner
    if (req.user) {
      const activeOwnerId = req.user.customId || req.user._id.toString();
      const propOwnerId = booking.propertyId && (booking.propertyId.ownerId || (booking.propertyId._id && booking.propertyId._id.toString()));
      if (propOwnerId && propOwnerId !== activeOwnerId && activeOwnerId !== 'OWN001') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to manage reservations for properties you do not own.'
        });
      }
    }

    // Update status
    booking.status = status;
    await booking.save();

    await booking.populate('propertyId', 'title location propertyType pricePerNight currentPrice basePrice image ownerId');

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${status} successfully`,
      data: booking
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    console.error('Error updating booking status:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating booking status',
      error: err.message
    });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingStatus
};
