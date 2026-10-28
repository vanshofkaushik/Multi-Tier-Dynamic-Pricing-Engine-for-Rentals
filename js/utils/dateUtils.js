/**
 * DynamicRent - Utilities: Date Calculations (js/utils/dateUtils.js)
 * Date formatting, validation, range comparison, and night span calculations.
 */

const DateUtils = {
  /**
   * Get today's date formatted as YYYY-MM-DD in local timezone
   * @returns {string}
   */
  getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Get tomorrow's date formatted as YYYY-MM-DD
   * @param {string} [fromDateStr] Base date string, defaults to today
   * @returns {string}
   */
  getTomorrowDateString(fromDateStr) {
    const base = fromDateStr ? new Date(fromDateStr) : new Date();
    base.setDate(base.getDate() + 1);
    const year = base.getFullYear();
    const month = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Calculate positive whole number of nights between check-in and check-out
   * @param {string} checkInStr YYYY-MM-DD
   * @param {string} checkOutStr YYYY-MM-DD
   * @returns {number} Number of nights (0 or negative if invalid)
   */
  calculateNights(checkInStr, checkOutStr) {
    if (!checkInStr || !checkOutStr) return 0;
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    
    // Normalize to midnight UTC for precise day calculation
    const utc1 = Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const utc2 = Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor((utc2 - utc1) / MS_PER_DAY);
    return diffDays > 0 ? diffDays : 0;
  },

  /**
   * Format ISO or YYYY-MM-DD date string to readable format e.g. "25 Aug 2026"
   * @param {string} dateStr 
   * @returns {string}
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (err) {
      return dateStr;
    }
  },

  /**
   * Check if a given date string is in the past (before today)
   * @param {string} dateStr YYYY-MM-DD
   * @returns {boolean}
   */
  isPastDate(dateStr) {
    if (!dateStr) return false;
    const todayStr = this.getTodayDateString();
    return dateStr < todayStr;
  },

  /**
   * Validate if check-in and check-out form a valid chronological booking window
   * @param {string} checkInStr 
   * @param {string} checkOutStr 
   * @returns {{ valid: boolean, error?: string }}
   */
  isValidDateRange(checkInStr, checkOutStr) {
    if (!checkInStr) {
      return { valid: false, error: 'Please select a check-in date.' };
    }
    if (!checkOutStr) {
      return { valid: false, error: 'Please select a check-out date.' };
    }
    if (this.isPastDate(checkInStr)) {
      return { valid: false, error: 'Check-in date cannot be in the past.' };
    }
    if (checkOutStr <= checkInStr) {
      return { valid: false, error: 'Check-out date must be after check-in date.' };
    }
    return { valid: true };
  }
};

// Global standalone aliases
function formatDate(dateStr) {
  return DateUtils.formatDate(dateStr);
}

function calculateNights(checkIn, checkOut) {
  return DateUtils.calculateNights(checkIn, checkOut);
}

function isPastDate(dateStr) {
  return DateUtils.isPastDate(dateStr);
}

function isValidDateRange(checkIn, checkOut) {
  return DateUtils.isValidDateRange(checkIn, checkOut);
}

