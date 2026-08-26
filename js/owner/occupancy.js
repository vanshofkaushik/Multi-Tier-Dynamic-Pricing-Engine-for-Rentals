/**
 * DynamicRent - Owner Module: Occupancy Engine (js/owner/occupancy.js)
 * Step 7: Computes precise property and portfolio occupancy metrics.
 * 
 * Rules:
 * - Evaluates confirmed bookings ONLY (excludes pending & rejected).
 * - Excludes the check-out day (a booking from Aug 10 to Aug 13 occupies 10, 11, 12 = 3 nights).
 * - Clips nights strictly within the target month boundary.
 * - Prevents double counting of overlapping stays via unique calendar day keys.
 * - Aggregate portfolio formula: totalOccupiedNights / totalAvailableNights * 100.
 */

const OccupancyEngine = {
  MONTH_NAMES: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  /**
   * Get all confirmed bookings for a specific property
   * @param {string} propertyId 
   * @returns {Array} Array of confirmed booking objects
   */
  getPropertyConfirmedBookings(propertyId) {
    if (!propertyId || typeof StorageUtils === 'undefined') return [];
    const allBookings = StorageUtils.getBookings();
    return allBookings.filter(b => 
      b.propertyId === propertyId && 
      (b.status || '').toLowerCase() === 'confirmed'
    );
  },

  /**
   * Calculate occupied nights, available capacity, and occupancy percentage for a property in a given month/year
   * @param {string} propertyId 
   * @param {number} [targetMonth] 0-indexed (0 = Jan, 7 = Aug) or current month by default
   * @param {number} [targetYear] Full year e.g. 2026 or current year by default
   * @returns {{ propertyId: string, occupiedNights: number, availableNights: number, occupancyRate: number, confirmedBookingsCount: number, monthName: string, year: number }}
   */
  calculatePropertyOccupancy(propertyId, targetMonth, targetYear) {
    const now = new Date();
    const month = (typeof targetMonth === 'number' && targetMonth >= 0 && targetMonth <= 11) ? targetMonth : now.getMonth();
    const year = (typeof targetYear === 'number' && targetYear > 2000) ? targetYear : now.getFullYear();

    // Determine total calendar nights in the target month (e.g. 28, 30, 31)
    const availableNights = new Date(year, month + 1, 0).getDate();

    const confirmedBookings = this.getPropertyConfirmedBookings(propertyId);
    const occupiedDatesSet = new Set();

    confirmedBookings.forEach(booking => {
      if (!booking.checkIn || !booking.checkOut) return;

      const checkInParts = booking.checkIn.split('-').map(Number);
      const checkOutParts = booking.checkOut.split('-').map(Number);

      if (checkInParts.length !== 3 || checkOutParts.length !== 3) return;

      const checkInDate = new Date(checkInParts[0], checkInParts[1] - 1, checkInParts[2]);
      const checkOutDate = new Date(checkOutParts[0], checkOutParts[1] - 1, checkOutParts[2]);

      // Iterate through each occupied night (check-out day is explicitly excluded)
      const current = new Date(checkInDate);
      while (current < checkOutDate) {
        if (current.getFullYear() === year && current.getMonth() === month) {
          const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
          occupiedDatesSet.add(dateKey);
        }
        current.setDate(current.getDate() + 1);
      }
    });

    const occupiedNights = occupiedDatesSet.size;
    const rawRate = availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0;
    const occupancyRate = Math.min(100, Math.round(rawRate * 10) / 10);

    return {
      propertyId,
      occupiedNights,
      availableNights,
      occupancyRate,
      confirmedBookingsCount: confirmedBookings.length,
      monthName: this.MONTH_NAMES[month],
      year
    };
  },

  /**
   * Calculate aggregate portfolio occupancy across all properties owned by an owner
   * Formula: totalOccupiedNights / totalAvailableNights * 100 (weighted across all owner properties)
   * @param {string} ownerId 
   * @param {number} [targetMonth] 
   * @param {number} [targetYear] 
   * @returns {{ totalOccupiedNights: number, totalAvailableNights: number, overallOccupancyRate: number, propertyCount: number, monthName: string, year: number }}
   */
  calculateOverallOwnerOccupancy(ownerId, targetMonth, targetYear) {
    const now = new Date();
    const month = (typeof targetMonth === 'number' && targetMonth >= 0 && targetMonth <= 11) ? targetMonth : now.getMonth();
    const year = (typeof targetYear === 'number' && targetYear > 2000) ? targetYear : now.getFullYear();

    if (!ownerId || typeof StorageUtils === 'undefined') {
      return { 
        totalOccupiedNights: 0, 
        totalAvailableNights: 0, 
        overallOccupancyRate: 0, 
        propertyCount: 0, 
        monthName: this.MONTH_NAMES[month], 
        year 
      };
    }

    const ownerProperties = StorageUtils.getOwnerProperties(ownerId);
    if (ownerProperties.length === 0) {
      return { 
        totalOccupiedNights: 0, 
        totalAvailableNights: 0, 
        overallOccupancyRate: 0, 
        propertyCount: 0, 
        monthName: this.MONTH_NAMES[month], 
        year 
      };
    }

    let totalOccupiedNights = 0;
    let totalAvailableNights = 0;

    ownerProperties.forEach(prop => {
      const stats = this.calculatePropertyOccupancy(prop.id, month, year);
      totalOccupiedNights += stats.occupiedNights;
      totalAvailableNights += stats.availableNights;
    });

    const rawRate = totalAvailableNights > 0 ? (totalOccupiedNights / totalAvailableNights) * 100 : 0;
    const overallOccupancyRate = Math.min(100, Math.round(rawRate * 10) / 10);

    return {
      totalOccupiedNights,
      totalAvailableNights,
      overallOccupancyRate,
      propertyCount: ownerProperties.length,
      monthName: this.MONTH_NAMES[month],
      year
    };
  }
};

// Global standalone aliases for easy script consumption
function calculatePropertyOccupancy(propertyId, month, year) {
  return OccupancyEngine.calculatePropertyOccupancy(propertyId, month, year);
}

function calculateOverallOwnerOccupancy(ownerId, month, year) {
  return OccupancyEngine.calculateOverallOwnerOccupancy(ownerId, month, year);
}
