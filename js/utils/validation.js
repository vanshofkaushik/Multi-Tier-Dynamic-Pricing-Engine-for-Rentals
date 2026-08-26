/**
 * DynamicRent - Utilities: Validation Helpers
 * Provides input format checking, password rules, and unique ID generation.
 */

const ValidationUtils = {
  /**
   * Validate non-empty string
   * @param {string} value 
   * @returns {boolean}
   */
  isNonEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
  },

  /**
   * Validate email format using standard regex
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  },

  /**
   * Validate password minimum length (at least 6 characters)
   * @param {string} password 
   * @returns {boolean}
   */
  isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
  },

  /**
   * Generate a clean, unique ID for new users based on role
   * e.g., USR_17192837482_912 or OWN_17192837482_384
   * @param {string} role 'customer' | 'owner'
   * @returns {string}
   */
  generateUserId(role) {
    const prefix = (role === 'owner') ? 'OWN' : 'USR';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    return `${prefix}_${timestamp}_${random}`;
  },

  /**
   * Validate complete booking submission data
   * @param {Object} data { property, customer, checkIn, checkOut, guests }
   * @returns {{ valid: boolean, error?: string }}
   */
  validateBooking(data) {
    const { property, customer, checkIn, checkOut, guests } = data;

    // 1. Customer session validation
    if (!customer || !customer.id) {
      return { valid: false, error: 'Please log in as a customer to book.' };
    }

    // 2. Property existence and availability
    if (!property) {
      return { valid: false, error: 'Property not found.' };
    }
    if (property.status === 'unavailable') {
      return { valid: false, error: 'This property is currently unavailable.' };
    }

    // 3. Date presence & range validation
    if (!checkIn) {
      return { valid: false, error: 'Please select a check-in date.' };
    }
    if (!checkOut) {
      return { valid: false, error: 'Please select a check-out date.' };
    }

    if (typeof DateUtils !== 'undefined' && DateUtils.isPastDate(checkIn)) {
      return { valid: false, error: 'Check-in date cannot be in the past.' };
    }

    if (checkOut <= checkIn) {
      return { valid: false, error: 'Check-out date must be after check-in date.' };
    }

    // 4. Guest count validation
    const numGuests = parseInt(guests, 10);
    if (isNaN(numGuests) || numGuests < 1) {
      return { valid: false, error: 'At least 1 guest is required.' };
    }
    const maxGuests = property.guests || 1;
    if (numGuests > maxGuests) {
      return { valid: false, error: `Maximum ${maxGuests} guests allowed for this property.` };
    }

    // 5. Duplicate booking check
    if (typeof StorageUtils !== 'undefined') {
      const existingBookings = StorageUtils.getBookingsByCustomer(customer.id);
      const isDuplicate = existingBookings.some(b => 
        b.propertyId === property.id && 
        b.checkIn === checkIn && 
        b.checkOut === checkOut &&
        b.status !== 'cancelled' &&
        b.status !== 'rejected'
      );

      if (isDuplicate) {
        return { valid: false, error: 'This booking request has already been submitted.' };
      }
    }

    return { valid: true };
  }
};

// Global standalone alias
function validateBooking(data) {
  return ValidationUtils.validateBooking(data);
}

