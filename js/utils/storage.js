/**
 * DynamicRent - Utilities: Storage Manager (js/utils/storage.js)
 * Centralized wrapper for localStorage (users, properties) and sessionStorage (currentUser).
 */

const StorageUtils = {
  USERS_KEY: 'dynamicRentUsers',
  CURRENT_USER_KEY: 'currentUser',
  PROPERTIES_KEY: 'dynamicRentProperties',
  BOOKINGS_KEY: 'dynamicRentBookings',

  // ==========================================
  // User Storage Operations
  // ==========================================

  /**
   * Get all registered users from localStorage
   * @returns {Array} Array of user objects
   */
  getUsers() {
    try {
      const data = localStorage.getItem(this.USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to read users from localStorage:', err);
      return [];
    }
  },

  /**
   * Save entire users array to localStorage
   * @param {Array} users 
   */
  saveUsers(users) {
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    } catch (err) {
      console.error('Failed to save users to localStorage:', err);
    }
  },

  /**
   * Add a new user object to localStorage
   * @param {Object} user 
   */
  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },

  /**
   * Find user by email (case-insensitive)
   * @param {string} email 
   * @returns {Object|undefined}
   */
  findUserByEmail(email) {
    if (!email) return undefined;
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  },

  // ==========================================
  // Session Storage Operations
  // ==========================================

  /**
   * Get current logged-in user from sessionStorage
   * @returns {Object|null}
   */
  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(this.CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to read currentUser from sessionStorage:', err);
      return null;
    }
  },

  /**
   * Store logged-in user into sessionStorage
   * @param {Object} user 
   */
  setCurrentUser(user) {
    try {
      sessionStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('Failed to write currentUser to sessionStorage:', err);
    }
  },

  /**
   * Clear session on logout
   */
  clearCurrentUser() {
    sessionStorage.removeItem(this.CURRENT_USER_KEY);
  },

  // ==========================================
  // Property Storage Operations (Step 4)
  // ==========================================

  /**
   * Retrieve all property listings from localStorage
   * @returns {Array} Array of property objects
   */
  getProperties() {
    try {
      const data = localStorage.getItem(this.PROPERTIES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // If empty or missing, fallback to INITIAL_PROPERTIES if available
      if (typeof INITIAL_PROPERTIES !== 'undefined') {
        localStorage.setItem(this.PROPERTIES_KEY, JSON.stringify(INITIAL_PROPERTIES));
        return INITIAL_PROPERTIES;
      }
      return [];
    } catch (err) {
      console.error('Failed to read properties from localStorage:', err);
      return typeof INITIAL_PROPERTIES !== 'undefined' ? INITIAL_PROPERTIES : [];
    }
  },

  /**
   * Persist properties array to localStorage
   * @param {Array} properties 
   */
  saveProperties(properties) {
    try {
      localStorage.setItem(this.PROPERTIES_KEY, JSON.stringify(properties));
    } catch (err) {
      console.error('Failed to save properties to localStorage:', err);
    }
  },

  /**
   * Retrieve a specific property by its unique ID
   * @param {string} id 
   * @returns {Object|null}
   */
  getPropertyById(id) {
    if (!id) return null;
    const properties = this.getProperties();
    return properties.find(p => p.id.toUpperCase() === id.trim().toUpperCase()) || null;
  },

  // ==========================================
  // Booking Storage Operations (Step 5)
  // ==========================================

  /**
   * Retrieve all bookings from localStorage
   * @returns {Array} Array of booking objects
   */
  getBookings() {
    try {
      const data = localStorage.getItem(this.BOOKINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch (err) {
      console.error('Failed to read bookings from localStorage:', err);
      return [];
    }
  },

  /**
   * Persist bookings array to localStorage under 'dynamicRentBookings'
   * @param {Array} bookings 
   */
  saveBookings(bookings) {
    try {
      localStorage.setItem(this.BOOKINGS_KEY, JSON.stringify(bookings));
    } catch (err) {
      console.error('Failed to save bookings to localStorage:', err);
    }
  },

  /**
   * Add a single new booking object to localStorage
   * @param {Object} booking 
   */
  addBooking(booking) {
    const bookings = this.getBookings();
    bookings.push(booking);
    this.saveBookings(bookings);
  },

  /**
   * Retrieve bookings belonging to a specific customer
   * @param {string} customerId 
   * @returns {Array} Filtered booking objects
   */
  getBookingsByCustomer(customerId) {
    if (!customerId) return [];
    const bookings = this.getBookings();
    return bookings.filter(b => b.customerId === customerId);
  },

  /**
   * Retrieve a specific booking by its booking ID
   * @param {string} bookingId 
   * @returns {Object|null}
   */
  getBookingById(bookingId) {
    if (!bookingId) return null;
    const bookings = this.getBookings();
    return bookings.find(b => b.id.toUpperCase() === bookingId.trim().toUpperCase()) || null;
  },

  /**
   * Generate a unique sequential booking ID e.g. BOOK001, BOOK002
   * @returns {string}
   */
  generateBookingId() {
    const bookings = this.getBookings();
    const existingIds = new Set(bookings.map(b => b.id));
    let nextNum = bookings.length + 1;
    let newId = `BOOK${String(nextNum).padStart(3, '0')}`;
    while (existingIds.has(newId)) {
      nextNum++;
      newId = `BOOK${String(nextNum).padStart(3, '0')}`;
    }
    return newId;
  },

  // ==========================================
  // Owner Storage Operations (Step 6)
  // ==========================================

  /**
   * Retrieve properties owned by a specific owner
   * @param {string} ownerId 
   * @returns {Array} Properties matching ownerId
   */
  getOwnerProperties(ownerId) {
    if (!ownerId) return [];
    const properties = this.getProperties();
    return properties.filter(p => p.ownerId === ownerId);
  },

  /**
   * Retrieve all bookings for properties owned by a specific owner
   * @param {string} ownerId 
   * @returns {Array} Bookings for the owner's properties
   */
  getOwnerBookings(ownerId) {
    if (!ownerId) return [];
    const ownerProperties = this.getOwnerProperties(ownerId);
    const ownerPropIds = new Set(ownerProperties.map(p => p.id));
    const allBookings = this.getBookings();
    return allBookings.filter(b => ownerPropIds.has(b.propertyId));
  },

  /**
   * Update the status of a booking with owner authorization and double-action protection
   * @param {string} bookingId 
   * @param {string} newStatus 'confirmed' | 'rejected'
   * @param {string} ownerId The ID of the authenticated owner
   * @returns {{ success: boolean, message: string, booking?: Object }}
   */
  updateBookingStatus(bookingId, newStatus, ownerId) {
    if (!bookingId || !newStatus || !ownerId) {
      return { success: false, message: 'Invalid parameters for status update.' };
    }

    const bookings = this.getBookings();
    const bookingIndex = bookings.findIndex(b => b.id.toUpperCase() === bookingId.trim().toUpperCase());

    if (bookingIndex === -1) {
      return { success: false, message: 'Booking not found.' };
    }

    const targetBooking = bookings[bookingIndex];

    // 1. Verify property exists and belongs to the current owner
    const property = this.getPropertyById(targetBooking.propertyId);
    if (!property || property.ownerId !== ownerId) {
      return { success: false, message: 'You are not authorized to manage this booking.' };
    }

    // 2. Double-action protection: only 'pending' bookings can be updated
    const currentStatus = (targetBooking.status || 'pending').toLowerCase();
    if (currentStatus !== 'pending') {
      return {
        success: false,
        message: `Cannot change status of a booking that is already ${currentStatus}.`
      };
    }

    // 3. Apply state transition
    targetBooking.status = newStatus.toLowerCase();
    targetBooking.statusUpdatedAt = new Date().toISOString();

    // 4. Save to localStorage
    bookings[bookingIndex] = targetBooking;
    this.saveBookings(bookings);

    const message = newStatus.toLowerCase() === 'confirmed' 
      ? 'Booking confirmed successfully.' 
      : 'Booking rejected.';

    return {
      success: true,
      message: message,
      booking: targetBooking
    };
  }
};

// Global standalone aliases for seamless access across scripts
function getBookings() {
  return StorageUtils.getBookings();
}

function saveBookings(bookings) {
  StorageUtils.saveBookings(bookings);
}

function addBooking(booking) {
  StorageUtils.addBooking(booking);
}

function getBookingsByCustomer(customerId) {
  return StorageUtils.getBookingsByCustomer(customerId);
}

function getBookingById(bookingId) {
  return StorageUtils.getBookingById(bookingId);
}

function getOwnerProperties(ownerId) {
  return StorageUtils.getOwnerProperties(ownerId);
}

function getOwnerBookings(ownerId) {
  return StorageUtils.getOwnerBookings(ownerId);
}

function updateBookingStatus(bookingId, newStatus, ownerId) {
  return StorageUtils.updateBookingStatus(bookingId, newStatus, ownerId);
}


