/**
 * DynamicRent - Owner Module: Demand Engine (js/owner/demandEngine.js)
 * Step 7: Evaluates live demand scores (0–100) and tiers (Low, Medium, High, Very High).
 * 
 * Factors:
 * 1. Occupancy Rate (50% Weight): Driven by confirmed bookings in current month.
 * 2. Booking Velocity & Count (30% Weight): Volume of confirmed bookings and recent activity.
 * 3. Capacity & Availability Pressure (20% Weight): Ratio of remaining capacity to demand.
 * 
 * NOTE: Pure computation module. DOES NOT mutate property prices (price adjustments are reserved for Step 8).
 */

const DemandEngine = {
  /**
   * Calculate composite demand score and classify demand tier for a given property
   * @param {string} propertyId 
   * @returns {{ score: number, level: 'Low' | 'Medium' | 'High' | 'Very High', occupancyRate: number, confirmedCount: number, badgeClass: string, factors: Object }}
   */
  calculateDemandScore(propertyId) {
    if (!propertyId || typeof OccupancyEngine === 'undefined') {
      return { 
        score: 25, 
        level: 'Low', 
        occupancyRate: 0, 
        confirmedCount: 0, 
        badgeClass: 'demand-low',
        factors: { occupancy: 0, velocity: 15, availability: 10 }
      };
    }

    // 1. Compute current month occupancy stats
    const occStats = OccupancyEngine.calculatePropertyOccupancy(propertyId);
    const occupancyRate = occStats.occupancyRate; // 0 - 100%

    // Factor 1: Occupancy Weight (50% maximum)
    const occupancyFactor = Math.min(50, Math.round((occupancyRate / 100) * 50));

    // Factor 2: Booking Count & Velocity Weight (30% maximum)
    // Confirmed bookings count + recent bookings activity
    const confirmedCount = occStats.confirmedBookingsCount;
    let velocityFactor = 6; // Baseline interest

    if (confirmedCount === 1) {
      velocityFactor = 14;
    } else if (confirmedCount === 2) {
      velocityFactor = 20;
    } else if (confirmedCount === 3) {
      velocityFactor = 25;
    } else if (confirmedCount >= 4) {
      velocityFactor = Math.min(30, 25 + (confirmedCount - 3) * 2.5);
    }

    // Factor 3: Availability Pressure (20% maximum)
    // As remaining nights decrease in proportion to the month, availability pressure rises
    const availableNights = occStats.availableNights || 30;
    const occupiedNights = occStats.occupiedNights || 0;
    const remainingNights = Math.max(0, availableNights - occupiedNights);
    
    // High ratio of occupied nights indicates high pressure on remaining inventory
    const pressureRatio = availableNights > 0 ? (occupiedNights / availableNights) : 0;
    const availabilityFactor = Math.round(Math.min(20, Math.max(4, 4 + (pressureRatio * 16))));

    // Sum all components (bounded 0 to 100)
    const rawScore = occupancyFactor + velocityFactor + availabilityFactor;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Map score to Demand Tier according to Step 7 specification:
    // 0–39: Low, 40–59: Medium, 60–79: High, 80–100: Very High
    let level = 'Low';
    let badgeClass = 'demand-low';

    if (score >= 80) {
      level = 'Very High';
      badgeClass = 'demand-very-high';
    } else if (score >= 60) {
      level = 'High';
      badgeClass = 'demand-high';
    } else if (score >= 40) {
      level = 'Medium';
      badgeClass = 'demand-medium';
    } else {
      level = 'Low';
      badgeClass = 'demand-low';
    }

    return {
      score,
      level,
      occupancyRate,
      confirmedCount,
      badgeClass,
      factors: {
        occupancyFactor,
        velocityFactor,
        availabilityFactor,
        remainingNights
      }
    };
  },

  /**
   * Generate HTML badge markup for demand level and score
   * @param {string} level 
   * @param {number} score 
   * @returns {string} Clean HTML badge markup
   */
  getDemandBadgeHtml(level, score) {
    let badgeClass = 'demand-low';
    let icon = '●';

    switch (level) {
      case 'Very High':
        badgeClass = 'demand-very-high';
        icon = '⚡⚡';
        break;
      case 'High':
        badgeClass = 'demand-high';
        icon = '⚡';
        break;
      case 'Medium':
        badgeClass = 'demand-medium';
        icon = '▲';
        break;
      case 'Low':
      default:
        badgeClass = 'demand-low';
        icon = '●';
        break;
    }

    return `<span class="demand-badge ${badgeClass}">${icon} ${level} &bull; ${score}/100</span>`;
  }
};

// Global standalone aliases
function calculateDemandScore(propertyId) {
  return DemandEngine.calculateDemandScore(propertyId);
}

function getDemandBadgeHtml(level, score) {
  return DemandEngine.getDemandBadgeHtml(level, score);
}
