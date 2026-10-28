const Booking = require('../models/Booking');

/**
 * Dynamic Pricing Service for DynamicRent
 * 
 * Implements a transparent, deterministic multi-factor pricing formula:
 * 
 *   Suggested Nightly Price = Base Price × Clamped Multiplier
 *   Where Clamped Multiplier = Clamp(1 + OccupancyAdj + LeadTimeAdj + DurationAdj, MIN=0.70, MAX=1.60)
 * 
 * Rounding: Final nightly price is rounded to the nearest ₹50.
 * Integrity: Prices cannot fall below 70% of base or exceed 160% of base.
 */
class PricingService {
  // Configurable bounds
  static MIN_MULTIPLIER = 0.70; // Maximum 30% discount floor
  static MAX_MULTIPLIER = 1.60; // Maximum 60% surge ceiling

  /**
   * Calculate dynamic pricing recommendation for a property and stay window
   * @param {Object} property Mongoose Property document
   * @param {Date} checkInDate Requested check-in date
   * @param {Date} checkOutDate Requested check-out date
   * @returns {Promise<Object>} Calculated quote breakdown and factors
   */
  static async calculateQuote(property, checkInDate, checkOutDate, options = {}) {
    // 1. Base Price: Always use property.basePrice (original anchor), never currentPrice or approvedPrice
    const basePrice = (property.basePrice !== undefined && property.basePrice !== null)
      ? property.basePrice
      : property.pricePerNight;
    const currentPrice = (property.currentPrice !== undefined && property.currentPrice !== null)
      ? property.currentPrice
      : property.pricePerNight;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkInDay = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());

    // 1. Duration in days / nights
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const durationDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    // 2. Lead time in days
    const leadTimeDiff = checkInDay.getTime() - today.getTime();
    const leadTimeDays = Math.max(0, Math.round(leadTimeDiff / (1000 * 60 * 60 * 24)));

    // 3. Query confirmed bookings overlapping the requested date window
    const overlappingBookings = await Booking.find({
      propertyId: property._id,
      status: 'Confirmed',
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate }
    });

    const bookingCount = overlappingBookings.length;

    // 4. Query 30-day window around check-in to compute local market occupancy rate
    const windowStart = new Date(checkInDate.getTime() - 15 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(checkOutDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    const windowBookings = await Booking.find({
      propertyId: property._id,
      status: 'Confirmed',
      checkIn: { $lt: windowEnd },
      checkOut: { $gt: windowStart }
    });

    // Derive occupancy rate and demand score
    let occupancyRate = 20; // Default baseline for available properties
    if (windowBookings.length === 1) occupancyRate = 45;
    else if (windowBookings.length === 2) occupancyRate = 70;
    else if (windowBookings.length >= 3) occupancyRate = 90;

    if (bookingCount > 0) {
      occupancyRate = Math.min(100, occupancyRate + 20);
    }

    let demandScore = Math.min(100, Math.round(occupancyRate * 0.75 + bookingCount * 15));

    // Support input overrides if explicit demand/occupancy parameters are passed
    if (options && options.occupancyRate !== undefined && !isNaN(Number(options.occupancyRate))) {
      occupancyRate = Math.min(100, Math.max(0, Number(options.occupancyRate)));
    }
    if (options && options.demandScore !== undefined && !isNaN(Number(options.demandScore))) {
      demandScore = Math.min(100, Math.max(0, Number(options.demandScore)));
    }

    // 5. Factor Adjustments
    const explanations = [];

    // Factor A: Occupancy Adjustment
    let occupancyAdjustment = 0.0;
    if (occupancyRate >= 80) {
      occupancyAdjustment = 0.20;
      explanations.push(`High occupancy (${occupancyRate}%): +20% demand surge applied`);
    } else if (occupancyRate >= 60) {
      occupancyAdjustment = 0.10;
      explanations.push(`Moderate-high occupancy (${occupancyRate}%): +10% demand surge applied`);
    } else if (occupancyRate < 35) {
      occupancyAdjustment = -0.10;
      explanations.push(`Low occupancy (${occupancyRate}%): -10% discount to attract bookings`);
    } else {
      occupancyAdjustment = 0.0;
      explanations.push(`Balanced occupancy (${occupancyRate}%): standard rate maintained`);
    }

    // Factor B: Lead Time Adjustment
    let leadTimeAdjustment = 0.0;
    if (leadTimeDays <= 3) {
      leadTimeAdjustment = 0.10;
      explanations.push(`Last-minute booking (${leadTimeDays} days lead time): +10% premium`);
    } else if (leadTimeDays >= 30) {
      leadTimeAdjustment = -0.08;
      explanations.push(`Early-bird booking (${leadTimeDays} days advance): -8% incentive`);
    } else {
      leadTimeAdjustment = 0.0;
      explanations.push(`Normal booking window (${leadTimeDays} days lead time): standard rate`);
    }

    // Factor C: Duration / Length-of-Stay Adjustment
    let durationAdjustment = 0.0;
    if (durationDays >= 7) {
      durationAdjustment = -0.10;
      explanations.push(`Extended stay (${durationDays} nights): -10% weekly discount`);
    } else if (durationDays >= 3) {
      durationAdjustment = -0.05;
      explanations.push(`Multi-night stay (${durationDays} nights): -5% stay discount`);
    } else {
      durationAdjustment = 0.05;
      explanations.push(`Short stay (${durationDays} nights): +5% turnover premium`);
    }

    // 6. Net Multiplier & Clamping
    const rawMultiplier = 1.0 + occupancyAdjustment + leadTimeAdjustment + durationAdjustment;
    const netMultiplier = Math.round(rawMultiplier * 100) / 100;

    let clampedMultiplier = netMultiplier;
    if (clampedMultiplier < this.MIN_MULTIPLIER) {
      clampedMultiplier = this.MIN_MULTIPLIER;
      explanations.push(`Multiplier bounded by minimum safety floor of ${this.MIN_MULTIPLIER}x (-30% max discount)`);
    } else if (clampedMultiplier > this.MAX_MULTIPLIER) {
      clampedMultiplier = this.MAX_MULTIPLIER;
      explanations.push(`Multiplier bounded by maximum surge cap of ${this.MAX_MULTIPLIER}x (+60% max surge)`);
    }

    // 7. Calculate final suggested nightly price (rounded to nearest ₹50)
    const rawCalculated = basePrice * clampedMultiplier;
    const calculatedPrice = Math.max(0, Math.round(rawCalculated / 50) * 50);
    const totalEstimatedPrice = calculatedPrice * durationDays;

    return {
      propertyId: property._id,
      propertyTitle: property.title,
      basePrice,
      currentPrice,
      calculatedPrice,
      totalEstimatedPrice,
      durationDays,
      leadTimeDays,
      occupancyRate,
      demandScore,
      bookingCount,
      multipliers: {
        occupancyAdjustment,
        leadTimeAdjustment,
        durationAdjustment,
        netMultiplier,
        clampedMultiplier,
        minAllowedMultiplier: this.MIN_MULTIPLIER,
        maxAllowedMultiplier: this.MAX_MULTIPLIER
      },
      explanations,
      isSuggestion: true
    };
  }
}

module.exports = PricingService;
