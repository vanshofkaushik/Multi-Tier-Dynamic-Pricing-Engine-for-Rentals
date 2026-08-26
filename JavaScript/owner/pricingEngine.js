/**
 * DynamicRent - Owner Module: Core Dynamic Pricing Engine (js/owner/pricingEngine.js)
 * Step 8: Multi-factor rule-based pricing engine calculating optimal recommended rates.
 * 
 * Formula:
 * Recommended Price = Base Price 
 *                     × (1 + Occupancy Adjustment)
 *                     × (1 + Demand Adjustment)
 *                     × (1 + Season Adjustment)
 *                     × (1 + Day Adjustment)
 *                     × (1 + Amenity Adjustment)
 * 
 * Then clamped between [minPrice, maxPrice] and rounded to nearest ₹50.
 * NOTE: Pure calculation engine. DOES NOT mutate property prices without owner approval.
 */

const PricingEngine = {
  /**
   * Calculate occupancy adjustment decimal based on occupancy rate percentage
   * @param {number} occupancyRate 0 - 100
   * @returns {number} Decimal adjustment e.g. -0.10, 0.00, 0.10, 0.20, 0.30
   */
  getOccupancyAdjustment(occupancyRate) {
    const occ = typeof occupancyRate === 'number' ? occupancyRate : 0;
    if (occ < 30) {
      return -0.10; // -10% for low occupancy
    } else if (occ < 60) {
      return 0.00;  // 0% for normal baseline occupancy
    } else if (occ < 80) {
      return 0.10;  // +10% for high occupancy
    } else if (occ < 90) {
      return 0.20;  // +20% for very high occupancy
    } else {
      return 0.30;  // +30% for near-full capacity
    }
  },

  /**
   * Calculate demand adjustment decimal based on demand score (0–100)
   * @param {number} demandScore 0 - 100
   * @returns {number} Decimal adjustment e.g. -0.05, 0.00, 0.10, 0.20
   */
  getDemandAdjustment(demandScore) {
    const score = typeof demandScore === 'number' ? demandScore : 0;
    if (score < 40) {
      return -0.05; // -5% Low demand
    } else if (score < 60) {
      return 0.00;  // 0% Medium demand
    } else if (score < 80) {
      return 0.10;  // +10% High demand
    } else {
      return 0.20;  // +20% Very High demand
    }
  },

  /**
   * Calculate cumulative amenity adjustment for a property (capped at +15% maximum)
   * @param {Object} property 
   * @returns {number} Decimal adjustment e.g. 0.05, 0.10, 0.15
   */
  getAmenityAdjustment(property) {
    if (!property || !Array.isArray(property.amenities)) return 0.00;

    const amenities = property.amenities.map(a => (a || '').toLowerCase());
    let cumulative = 0.00;

    // Premium amenity weights
    if (amenities.some(a => a.includes('pool') || a.includes('swimming'))) cumulative += 0.05;
    if (amenities.some(a => a.includes('air conditioning') || a.includes('ac'))) cumulative += 0.03;
    if (amenities.some(a => a.includes('gym'))) cumulative += 0.03;
    if (amenities.some(a => a.includes('lake') || a.includes('beach'))) cumulative += 0.04;
    if (amenities.some(a => a.includes('lawn') || a.includes('garden') || a.includes('power backup'))) cumulative += 0.02;
    if (amenities.some(a => a.includes('balcony') || a.includes('patio'))) cumulative += 0.02;
    if (amenities.some(a => a.includes('tub') || a.includes('jacuzzi'))) cumulative += 0.05;

    // Cap total amenity adjustment at +15%
    return Math.min(0.15, Math.round(cumulative * 100) / 100);
  },

  /**
   * Core function: Calculate dynamic recommended price and full transparent breakdown
   * @param {string} propertyId 
   * @param {Date|string} [targetDate] 
   * @returns {Object} Comprehensive pricing calculation result
   */
  calculateDynamicPrice(propertyId, targetDate) {
    if (!propertyId || typeof StorageUtils === 'undefined') {
      return this.getFallbackPricing(propertyId);
    }

    const property = StorageUtils.getPropertyById(propertyId);
    if (!property) {
      return this.getFallbackPricing(propertyId);
    }

    // 1. Base Price (The starting anchor reference, never currentPrice)
    const basePrice = property.basePrice || property.pricePerNight || property.currentPrice || 4000;
    const currentPrice = property.currentPrice || property.pricePerNight || basePrice;
    const minPrice = property.minPrice || Math.round(basePrice * 0.65);
    const maxPrice = property.maxPrice || Math.round(basePrice * 1.65);

    // 2. Parse target date and calculate month for occupancy
    const dateObj = (typeof SeasonRules !== 'undefined') 
      ? SeasonRules.parseDate(targetDate) 
      : new Date();
    const targetMonth = dateObj.getMonth();
    const targetYear = dateObj.getFullYear();

    // 3. Occupancy Factor (from Step 7 Occupancy Engine)
    const occStats = (typeof OccupancyEngine !== 'undefined')
      ? OccupancyEngine.calculatePropertyOccupancy(propertyId, targetMonth, targetYear)
      : { occupancyRate: 50, confirmedBookingsCount: 0 };
    const occAdj = this.getOccupancyAdjustment(occStats.occupancyRate);

    // 4. Demand Factor (from Step 7 Demand Engine)
    const demandStats = (typeof DemandEngine !== 'undefined')
      ? DemandEngine.calculateDemandScore(propertyId)
      : { score: 50, level: 'Medium' };
    const demAdj = this.getDemandAdjustment(demandStats.score);

    // 5. Season Factor (from SeasonRules)
    const seasonInfo = (typeof SeasonRules !== 'undefined')
      ? SeasonRules.getSeasonAdjustment(dateObj)
      : { season: 'Normal Season', adjustment: 0.00, percentage: 0 };
    const seasonAdj = seasonInfo.adjustment;

    // 6. Day of Week Factor (from SeasonRules)
    const dayInfo = (typeof SeasonRules !== 'undefined')
      ? SeasonRules.getDayAdjustment(dateObj)
      : { dayName: 'Friday', isWeekend: true, adjustment: 0.05, percentage: 5 };
    const dayAdj = dayInfo.adjustment;

    // 7. Amenity Factor
    const amenityAdj = this.getAmenityAdjustment(property);

    // 8. Compound Formula
    // Base Price × (1 + Occ) × (1 + Dem) × (1 + Season) × (1 + Day) × (1 + Amenity)
    const rawCalculatedPrice = basePrice * 
      (1 + occAdj) * 
      (1 + demAdj) * 
      (1 + seasonAdj) * 
      (1 + dayAdj) * 
      (1 + amenityAdj);

    // 9. Price Limits Clamping [minPrice, maxPrice]
    let isClampedMin = false;
    let isClampedMax = false;
    let clampedPrice = rawCalculatedPrice;

    if (rawCalculatedPrice < minPrice) {
      clampedPrice = minPrice;
      isClampedMin = true;
    } else if (rawCalculatedPrice > maxPrice) {
      clampedPrice = maxPrice;
      isClampedMax = true;
    }

    // 10. Clean Rounding to nearest ₹50
    const recommendedPrice = Math.round(clampedPrice / 50) * 50;

    // 11. Price Change metrics vs currentPrice
    const priceChange = recommendedPrice - currentPrice;
    const rawChangePct = currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;
    const priceChangePercent = Math.round(rawChangePct * 10) / 10;

    // 12. Dynamic Human-Readable Explanation Builder
    const explanation = this.buildExplanation({
      priceChange,
      priceChangePercent,
      occRate: occStats.occupancyRate,
      occAdj,
      demandLevel: demandStats.level,
      demandScore: demandStats.score,
      demAdj,
      seasonName: seasonInfo.season,
      seasonAdj,
      dayName: dayInfo.dayName,
      dayAdj,
      amenityAdj,
      isClampedMin,
      isClampedMax,
      minPrice,
      maxPrice
    });

    return {
      propertyId,
      propertyName: property.name,
      propertyLocation: property.location,
      basePrice,
      currentPrice,
      minPrice,
      maxPrice,
      targetDate: (typeof DateUtils !== 'undefined') ? DateUtils.getTodayDateString() : new Date().toISOString().split('T')[0],
      selectedDateObj: dateObj,
      
      // Metrics & Multipliers
      occupancy: occStats.occupancyRate,
      occupancyAdjustment: occAdj,
      demandScore: demandStats.score,
      demandLevel: demandStats.level,
      demandAdjustment: demAdj,
      seasonName: seasonInfo.season,
      seasonAdjustment: seasonAdj,
      dayName: dayInfo.dayName,
      dayAdjustment: dayAdj,
      amenityAdjustment: amenityAdj,

      // Final Prices
      rawCalculatedPrice: Math.round(rawCalculatedPrice),
      clampedPrice: Math.round(clampedPrice),
      recommendedPrice,
      priceChange,
      priceChangePercent,
      isClampedMin,
      isClampedMax,
      explanation,

      // Itemized breakdown table
      breakdown: {
        basePrice,
        occupancyPct: Math.round(occAdj * 100),
        demandPct: Math.round(demAdj * 100),
        seasonPct: Math.round(seasonAdj * 100),
        dayPct: Math.round(dayAdj * 100),
        amenityPct: Math.round(amenityAdj * 100),
        recommendedPrice
      }
    };
  },

  /**
   * Build transparent, contextual natural-language explanation of pricing reasons
   * @param {Object} factors 
   * @returns {string} Dynamic explanation paragraph
   */
  buildExplanation(factors) {
    const reasons = [];

    // 1. Occupancy reason
    if (factors.occAdj >= 0.20) {
      reasons.push(`very high occupancy (${factors.occRate}%)`);
    } else if (factors.occAdj > 0) {
      reasons.push(`healthy occupancy (${factors.occRate}%)`);
    } else if (factors.occAdj < 0) {
      reasons.push(`low current occupancy (${factors.occRate}%)`);
    }

    // 2. Demand reason
    if (factors.demAdj >= 0.10) {
      reasons.push(`strong market demand score (${factors.demandScore}/100)`);
    } else if (factors.demAdj < 0) {
      reasons.push(`slower market demand (${factors.demandScore}/100)`);
    }

    // 3. Season reason
    if (factors.seasonAdj > 0) {
      reasons.push(`peak seasonal period (${factors.seasonName})`);
    } else if (factors.seasonAdj < 0) {
      reasons.push(`off-peak season (${factors.seasonName})`);
    }

    // 4. Day of week reason
    if (factors.dayAdj > 0) {
      reasons.push(`${factors.dayName} weekend surge`);
    }

    // 5. Amenity reason
    if (factors.amenityAdj > 0) {
      reasons.push(`premium property amenities (+${Math.round(factors.amenityAdj * 100)}%)`);
    }

    let summary = '';
    const joinedReasons = reasons.join(', ');

    if (factors.priceChange > 0) {
      summary = `Recommended price increased by ${Math.abs(factors.priceChangePercent)}% (+₹${factors.priceChange.toLocaleString('en-IN')}) driven by ${joinedReasons}.`;
    } else if (factors.priceChange < 0) {
      summary = `Recommended price adjusted downward by ${Math.abs(factors.priceChangePercent)}% (-₹${Math.abs(factors.priceChange).toLocaleString('en-IN')}) due to ${joinedReasons} to stimulate bookings.`;
    } else {
      summary = `Recommended price aligns with current rate based on balanced market signals (${joinedReasons || 'steady baseline metrics'}).`;
    }

    if (factors.isClampedMax) {
      summary += ` (Price capped at property maximum limit of ₹${factors.maxPrice.toLocaleString('en-IN')}).`;
    } else if (factors.isClampedMin) {
      summary += ` (Price protected at property minimum floor rate of ₹${factors.minPrice.toLocaleString('en-IN')}).`;
    }

    return summary;
  },

  /**
   * Fallback default pricing if property is not found
   * @param {string} propertyId 
   * @returns {Object}
   */
  getFallbackPricing(propertyId) {
    return {
      propertyId: propertyId || 'UNKNOWN',
      propertyName: 'Listing',
      basePrice: 4000,
      currentPrice: 4000,
      minPrice: 2800,
      maxPrice: 6500,
      occupancy: 0,
      occupancyAdjustment: 0,
      demandScore: 50,
      demandLevel: 'Medium',
      demandAdjustment: 0,
      seasonName: 'Normal Season',
      seasonAdjustment: 0,
      dayName: 'Weekday',
      dayAdjustment: 0,
      amenityAdjustment: 0,
      recommendedPrice: 4000,
      priceChange: 0,
      priceChangePercent: 0,
      explanation: 'Standard baseline rate applied.',
      breakdown: {
        basePrice: 4000,
        occupancyPct: 0,
        demandPct: 0,
        seasonPct: 0,
        dayPct: 0,
        amenityPct: 0,
        recommendedPrice: 4000
      }
    };
  }
};

// Global standalone aliases
function calculateDynamicPrice(propertyId, targetDate) {
  return PricingEngine.calculateDynamicPrice(propertyId, targetDate);
}
