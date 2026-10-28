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
    sessionStorage.removeItem('token');
  },

  // ==========================================
  // Property Storage Operations (Step 4)
  // ==========================================

  /**
   * Retrieve all property listings.
   * NOTE: Properties must ONLY be loaded from the live Express/MongoDB API.
   * Stale cached properties in browser storage and demo datasets are ignored.
   * @returns {Array} Empty array (forcing live API usage)
   */
  getProperties() {
    return [];
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
    return null;
  },

  // ==========================================
  // Booking Storage Operations (Step 5)
  // ==========================================

  /**
   * Retrieve all bookings.
   * NOTE: Bookings must ONLY be loaded from the live Express/MongoDB API.
   * Stale cached bookings in browser storage and demo datasets are ignored.
   * @returns {Array} Empty array (forcing live API usage)
   */
  getBookings() {
    return [];
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
   * Add a single new booking object (Neutralized - backend required)
   * @param {Object} booking 
   */
  addBooking(booking) {
    console.warn('Direct local booking creation disabled. All bookings must be submitted via ApiClient.createBooking() to MongoDB.');
    return null;
  },

  /**
   * Retrieve bookings belonging to a specific customer
   * @param {string} customerId 
   * @returns {Array} Filtered booking objects
   */
  getBookingsByCustomer(customerId) {
    return [];
  },

  /**
   * Retrieve a specific booking by its booking ID
   * @param {string} bookingId 
   * @returns {Object|null}
   */
  getBookingById(bookingId) {
    return null;
  },

  /**
   * Generate a unique sequential booking ID e.g. BOOK001, BOOK002
   * @returns {string}
   */
  generateBookingId() {
    return 'BOOK_' + Date.now();
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
    return [];
  },

  /**
   * Retrieve all bookings for properties owned by a specific owner
   * @param {string} ownerId 
   * @returns {Array} Bookings for the owner's properties
   */
  getOwnerBookings(ownerId) {
    return [];
  },

  /**
   * Update the status of a booking.
   * NOTE: Status updates must ONLY be performed via backend API (ApiClient.updateBookingStatus).
   * Offline mutations are rejected to avoid fake success.
   * @param {string} bookingId 
   * @param {string} newStatus 'confirmed' | 'rejected'
   * @param {string} ownerId The ID of the authenticated owner
   * @returns {{ success: boolean, message: string }}
   */
  updateBookingStatus(bookingId, newStatus, ownerId) {
    return {
      success: false,
      message: 'Server connection required to update reservation. Please ensure backend is running.'
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

if (typeof window !== 'undefined') {
  window.StorageUtils = StorageUtils;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtils;
}


