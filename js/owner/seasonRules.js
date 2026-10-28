/**
 * DynamicRent - Owner Module: Season & Calendar Rules (js/owner/seasonRules.js)
 * Step 8: Calculates seasonal market multipliers and day-of-week weekend premiums.
 * 
 * Rules:
 * - Seasonality (Month-based):
 *   - December: Peak Season (+15%)
 *   - April–May: High Summer (+10%)
 *   - October–November: Festive Season (+5%)
 *   - June–September: Normal Season (0%)
 *   - January–March: Low / Off-Peak (-5%)
 * - Day of Week (Weekend surge):
 *   - Monday–Thursday: 0%
 *   - Friday: +5%
 *   - Saturday: +10%
 *   - Sunday: +5%
 */

const SeasonRules = {
  MONTH_NAMES: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  DAY_NAMES: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ],

  /**
   * Parse input date safely into a local Date instance
   * @param {Date|string} [dateInput] 
   * @returns {Date}
   */
  parseDate(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date && !isNaN(dateInput)) return dateInput;

    if (typeof dateInput === 'string') {
      const parts = dateInput.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      const d = new Date(dateInput);
      if (!isNaN(d)) return d;
    }
    return new Date();
  },

  /**
   * Calculate seasonal rate adjustment for a given date
   * @param {Date|string} [dateInput] 
   * @returns {{ season: string, adjustment: number, percentage: number, monthName: string, description: string }}
   */
  getSeasonAdjustment(dateInput) {
    const d = this.parseDate(dateInput);
    const month = d.getMonth(); // 0 = Jan, 11 = Dec
    const monthName = this.MONTH_NAMES[month];

    let season = 'Normal';
    let adjustment = 0.00;
    let description = 'Standard seasonal baseline rates apply.';

    if (month === 11) {
      // December
      season = 'Peak Season';
      adjustment = 0.15;
      description = 'December year-end holiday surge (+15%).';
    } else if (month === 3 || month === 4) {
      // April, May
      season = 'High Summer';
      adjustment = 0.10;
      description = 'Summer vacation travel window (+10%).';
    } else if (month === 9 || month === 10) {
      // October, November
      season = 'Festive Season';
      adjustment = 0.05;
      description = 'Diwali & autumn festival travel season (+5%).';
    } else if (month >= 5 && month <= 8) {
      // June, July, August, September
      season = 'Normal Season';
      adjustment = 0.00;
      description = 'Monsoon & standard booking window (0%).';
    } else {
      // January, February, March
      season = 'Low Season';
      adjustment = -0.05;
      description = 'Post-holiday off-peak window (-5%).';
    }

    return {
      season,
      adjustment,
      percentage: Math.round(adjustment * 100),
      monthName,
      description
    };
  },

  /**
   * Calculate day-of-week rate adjustment (weekend surge)
   * @param {Date|string} [dateInput] 
   * @returns {{ dayName: string, dayIndex: number, isWeekend: boolean, adjustment: number, percentage: number, description: string }}
   */
  getDayAdjustment(dateInput) {
    const d = this.parseDate(dateInput);
    const dayIndex = d.getDay(); // 0 = Sun, 6 = Sat
    const dayName = this.DAY_NAMES[dayIndex];

    let adjustment = 0.00;
    let isWeekend = false;
    let description = 'Standard weekday rate.';

    if (dayIndex === 6) {
      // Saturday
      adjustment = 0.10;
      isWeekend = true;
      description = 'Peak Saturday weekend getaway premium (+10%).';
    } else if (dayIndex === 5) {
      // Friday
      adjustment = 0.05;
      isWeekend = true;
      description = 'Friday weekend starter premium (+5%).';
    } else if (dayIndex === 0) {
      // Sunday
      adjustment = 0.05;
      isWeekend = true;
      description = 'Sunday weekend stay premium (+5%).';
    } else {
      // Monday - Thursday
      adjustment = 0.00;
      isWeekend = false;
      description = 'Midweek standard rate (0%).';
    }

    return {
      dayName,
      dayIndex,
      isWeekend,
      adjustment,
      percentage: Math.round(adjustment * 100),
      description
    };
  }
};

// Global standalone aliases
function getSeasonAdjustment(date) {
  return SeasonRules.getSeasonAdjustment(date);
}

function getDayAdjustment(date) {
  return SeasonRules.getDayAdjustment(date);
}
