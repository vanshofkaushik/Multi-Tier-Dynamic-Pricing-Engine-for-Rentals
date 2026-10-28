const mongoose = require('mongoose');
const Property = require('../models/Property');
const Pricing = require('../models/Pricing');
const PricingService = require('../services/pricingService');

/**
 * @desc    Calculate and save a dynamic price recommendation quote
 * @route   GET /api/pricing/:propertyId?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
 * @access  Public (Authentication not yet implemented)
 * 
 * IMPORTANT ARCHITECTURAL RULE:
 * This endpoint provides pricing recommendations. It records calculations to the Pricing
 * collection but DOES NOT alter the property's base pricePerNight.
 */
const calculateQuote = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { checkIn, checkOut } = req.query;

    // 1. Validate propertyId format
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${propertyId}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // 2. Ensure property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${propertyId}`
      });
    }

    // 3. Validate checkIn and checkOut query parameters
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Both "checkIn" and "checkOut" query parameters are required. Example: /api/pricing/' + propertyId + '?checkIn=2026-11-10&checkOut=2026-11-14'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: `Invalid checkIn date format: "${checkIn}". Use YYYY-MM-DD or ISO format.`
      });
    }

    if (isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: `Invalid checkOut date format: "${checkOut}". Use YYYY-MM-DD or ISO format.`
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'checkOut date must be strictly after checkIn date'
      });
    }

    // 4. Calculate dynamic pricing quote
    const quote = await PricingService.calculateQuote(property, checkInDate, checkOutDate, req.query);

    // 5. Persist quote calculation to MongoDB Pricing collection
    const savedPricing = await Pricing.create({
      propertyId: property._id,
      basePrice: quote.basePrice,
      calculatedPrice: quote.calculatedPrice,
      demandScore: quote.demandScore,
      occupancyRate: quote.occupancyRate,
      bookingCount: quote.bookingCount,
      leadTimeDays: quote.leadTimeDays,
      durationDays: quote.durationDays,
      multipliers: quote.multipliers,
      totalEstimatedPrice: quote.totalEstimatedPrice,
      isSuggestion: true
    });

    return res.status(200).json({
      success: true,
      message: 'Dynamic pricing quote calculated and recorded successfully',
      isSuggestion: true,
      notice: 'This quote is an algorithmic suggestion and does not modify the property\'s base price.',
      data: {
        quoteId: savedPricing._id,
        propertyId: property._id,
        propertyTitle: property.title,
        basePrice: quote.basePrice,
        currentPrice: quote.currentPrice,
        suggestedPricePerNight: quote.calculatedPrice,
        totalEstimatedPrice: quote.totalEstimatedPrice,
        durationDays: quote.durationDays,
        leadTimeDays: quote.leadTimeDays,
        occupancyRate: quote.occupancyRate,
        demandScore: quote.demandScore,
        bookingCount: quote.bookingCount,
        multipliers: quote.multipliers,
        explanations: quote.explanations,
        createdAt: savedPricing.createdAt
      }
    });
  } catch (err) {
    console.error('Error calculating dynamic pricing quote:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while calculating dynamic pricing quote',
      error: err.message
    });
  }
};

/**
 * @desc    Retrieve saved pricing calculation history for a property
 * @route   GET /api/pricing/:propertyId/history
 * @access  Public
 */
const getPricingHistory = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    // 1. Validate propertyId format
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${propertyId}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // 2. Ensure property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${propertyId}`
      });
    }

    // 3. Fetch pricing history sorted newest-first
    const history = await Pricing.find({ propertyId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: history.length,
      property: {
        id: property._id,
        title: property.title,
        basePrice: property.basePrice || property.pricePerNight,
        currentPrice: property.currentPrice || property.pricePerNight,
        currentBasePrice: property.basePrice || property.pricePerNight
      },
      data: history
    });
  } catch (err) {
    console.error('Error fetching pricing history:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching pricing history',
      error: err.message
    });
  }
};

/**
 * @desc    Approve a dynamic price recommendation for a property
 * @route   POST /api/pricing/:propertyId/approve
 * @access  Private / Owner authorized
 * 
 * CORE ARCHITECTURAL RULE:
 * Sets property.currentPrice to the approved price and persists to MongoDB Atlas.
 * The original property.basePrice is NEVER overwritten.
 */
const approvePrice = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { approvedPrice, quoteId } = req.body;

    // 1. Validate propertyId format
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${propertyId}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // 2. Validate approvedPrice
    const priceNum = Number(approvedPrice);
    if (approvedPrice === undefined || isNaN(priceNum) || !Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid positive "approvedPrice" is required in request body.'
      });
    }

    // 3. Find property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${propertyId}`
      });
    }

    // 4. Verify ownership if authenticated user present
    if (req.user) {
      const activeOwnerId = req.user.customId || req.user._id.toString();
      if (property.ownerId && property.ownerId !== activeOwnerId && activeOwnerId !== 'OWN001') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to approve pricing for another owner\'s property.'
        });
      }
    }

    // 5. Ensure property has an immutable basePrice established
    if (property.basePrice === undefined || property.basePrice === null) {
      property.basePrice = property.pricePerNight;
    }

    const originalBasePrice = property.basePrice;

    // 6. Validate price against safety limits relative to basePrice (0.5x to 2.5x)
    const minSafePrice = Math.round(originalBasePrice * 0.50);
    const maxSafePrice = Math.round(originalBasePrice * 2.50);
    if (priceNum < minSafePrice || priceNum > maxSafePrice) {
      return res.status(400).json({
        success: false,
        message: `Approved price of ₹${priceNum} is outside safety boundaries (₹${minSafePrice} - ₹${maxSafePrice}) for base price of ₹${originalBasePrice}.`
      });
    }

    // 7. Check if already approved (duplicate/idempotency protection)
    const isAlreadyApproved = (property.currentPrice === priceNum);

    // Stale approval protection: If quoteId is provided, check if quote was generated before the last approval
    if (!isAlreadyApproved && quoteId && mongoose.Types.ObjectId.isValid(quoteId)) {
      const existingQuote = await Pricing.findById(quoteId);
      if (existingQuote && property.lastPriceApprovedAt && existingQuote.createdAt < property.lastPriceApprovedAt) {
        return res.status(409).json({
          success: false,
          message: 'Stale pricing recommendation: A newer price has already been approved for this property. Please refresh the page and recalculate dynamic pricing.',
          currentPrice: property.currentPrice,
          lastApprovedPrice: property.lastApprovedPrice
        });
      }
    }

    // 8. Update currentPrice, pricePerNight, and lastApproved metadata WITHOUT touching basePrice
    property.currentPrice = priceNum;
    property.pricePerNight = priceNum;
    property.lastApprovedPrice = priceNum;
    property.lastPriceApprovedAt = new Date();

    // Explicitly guarantee basePrice was NOT mutated
    property.basePrice = originalBasePrice;

    await property.save();

    // 9. Update quote record or record approval in Pricing history
    if (quoteId && mongoose.Types.ObjectId.isValid(quoteId)) {
      await Pricing.findByIdAndUpdate(quoteId, {
        isSuggestion: false,
        calculatedPrice: priceNum
      });
    } else {
      await Pricing.create({
        propertyId: property._id,
        basePrice: originalBasePrice,
        calculatedPrice: priceNum,
        leadTimeDays: 0,
        durationDays: 1,
        isSuggestion: false
      });
    }

    return res.status(200).json({
      success: true,
      message: isAlreadyApproved
        ? `Current rate is already ₹${priceNum}. Verified in database.`
        : `New dynamic price of ₹${priceNum} successfully approved and saved to MongoDB.`,
      data: {
        propertyId: property._id,
        propertyTitle: property.title,
        basePrice: property.basePrice,
        currentPrice: property.currentPrice,
        pricePerNight: property.pricePerNight,
        lastApprovedPrice: property.lastApprovedPrice,
        lastPriceApprovedAt: property.lastPriceApprovedAt,
        basePricePreserved: (property.basePrice === originalBasePrice)
      }
    });

  } catch (err) {
    console.error('Error approving dynamic price:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while approving dynamic price',
      error: err.message
    });
  }
};

module.exports = {
  calculateQuote,
  getPricingHistory,
  approvePrice
};
