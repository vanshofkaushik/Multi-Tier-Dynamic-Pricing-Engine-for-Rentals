/**
 * DynamicRent - Centralized API Client (js/utils/api.js)
 * Step 1: Connects frontend components to the Express backend (http://localhost:5000/api).
 * 
 * ARCHITECTURAL GUIDELINES:
 * - Provides standardized, asynchronous fetch operations with explicit error handling.
 * - Normalizes MongoDB schemas (`_id`, `title`, `propertyType`) with frontend expectations (`id`, `name`, `type`).
 * - Does NOT implement silent fallbacks in this step; failed calls surface clear, actionable errors.
 */

// Proactively unregister any stale service workers, clear CacheStorage, and purge localStorage property caches
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister().then(() => console.log('[ApiClient] Unregistered active service worker:', reg.scope));
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then(keys => {
      for (const key of keys) {
        caches.delete(key).then(() => console.log('[ApiClient] Cleared CacheStorage cache:', key));
      }
    }).catch(() => {});
  }
  try {
    localStorage.removeItem('dynamicRentProperties');
    localStorage.removeItem('dynamicRentBookings');
  } catch (e) {}
}

const ApiClient = {
  // Base URL for the Express backend API
  BASE_URL: '/api',

  /**
   * Normalize a property object from MongoDB Atlas into a format fully compatible
   * with existing frontend templates.
   * Maps `_id` <-> `id`, `title` <-> `name`, `propertyType` <-> `type`.
   * @param {Object} prop Property object from backend
   * @returns {Object} Normalized property object
   */
  normalizeProperty(prop) {
    if (!prop || typeof prop !== 'object') return null;

    const idStr = prop._id ? String(prop._id) : (prop.id || '');
    const titleStr = prop.title || prop.name || 'Untitled Property';
    const typeStr = prop.propertyType || prop.type || 'Stay';
    const currentPrice = typeof prop.currentPrice === 'number' 
      ? prop.currentPrice 
      : (typeof prop.pricePerNight === 'number' ? prop.pricePerNight : 0);
    const basePrice = typeof prop.basePrice === 'number'
      ? prop.basePrice
      : (typeof prop.pricePerNight === 'number' ? prop.pricePerNight : currentPrice);

    return {
      ...prop,
      id: idStr,
      _id: idStr,
      title: titleStr,
      name: titleStr,
      propertyType: typeStr,
      type: typeStr,
      basePrice,
      currentPrice,
      pricePerNight: currentPrice
    };
  },

  /**
   * Normalize a booking document from MongoDB Atlas.
   * Ensures `id` and `_id` are synchronized, and normalizes nested propertyId if populated.
   * @param {Object} booking Booking object from backend
   * @returns {Object} Normalized booking object
   */
  normalizeBooking(booking) {
    if (!booking || typeof booking !== 'object') return null;

    const idStr = booking._id ? String(booking._id) : (booking.id || '');
    const normalized = {
      ...booking,
      id: idStr,
      _id: idStr
    };

    // If propertyId was populated by the backend with full property details
    if (normalized.propertyId && typeof normalized.propertyId === 'object') {
      normalized.propertyId = this.normalizeProperty(normalized.propertyId);
      // Populate convenient flat fields for existing frontend cards
      normalized.propertyName = normalized.propertyId.name || normalized.propertyName;
      normalized.propertyLocation = normalized.propertyId.location || normalized.propertyLocation;
      normalized.propertyImage = normalized.propertyId.image || normalized.propertyImage;
      normalized.pricePerNight = normalized.propertyId.pricePerNight !== undefined 
        ? normalized.propertyId.pricePerNight 
        : normalized.pricePerNight;
    }

    return normalized;
  },

  /**
   * Internal HTTP request helper.
   * Handles JSON encoding, network failure catching, and HTTP status checking.
   * Throws detailed errors on non-2xx responses.
   * @param {string} endpoint API endpoint relative to BASE_URL (e.g. '/properties')
   * @param {Object} [options] Fetch configuration options
   * @returns {Promise<Object>} Parsed JSON response body
   */
  async request(endpoint, options = {}) {
    let url = `${this.BASE_URL}${endpoint}`;

    // Add cache-busting timestamp to prevent any browser disk/memory caching of GET requests
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}_t=${Date.now()}`;
    }

    const headers = {
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      ...options.headers
    };

    // Automatically attach Bearer token if session exists
    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If sending a body and Content-Type is not set, default to application/json
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(url, { cache: 'no-store', ...options, headers });
    } catch (networkErr) {
      console.error(`[ApiClient] Network request failed for ${url}:`, networkErr);
      throw new Error(
        'Unable to connect to the server. Please try again.'
      );
    }

    // Safely parse JSON or text response
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error(`[ApiClient] Failed to parse JSON from ${url}:`, parseErr);
        throw new Error(`Invalid JSON response received from server (${response.status})`);
      }
    } else {
      const rawText = await response.text();
      data = { message: rawText || response.statusText };
    }

    // Check HTTP status code
    if (!response.ok) {
      const errorMsg = (data && data.message) || (data && data.error) || response.statusText || 'Request failed';
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      console.error(`[ApiClient] HTTP ${response.status} Error on ${options.method || 'GET'} ${endpoint}:`, errorMsg);
      throw err;
    }

    return data;
  },

  // =========================================================================
  // Health Check
  // =========================================================================

  /**
   * Check backend server operational status and MongoDB Atlas connection
   * @returns {Promise<Object>} Status response
   */
  async checkHealth() {
    return await this.request('/health', { method: 'GET' });
  },

  // =========================================================================
  // Property Operations
  // =========================================================================

  /**
   * Retrieve all properties from MongoDB Atlas with optional filter criteria
   * @param {Object} [filters] Optional query filters: { location, propertyType, ownerId, minPrice, maxPrice }
   * @returns {Promise<Array>} Array of normalized property objects
   */
  async getProperties(filters = {}) {
    const params = new URLSearchParams();
    if (filters.location) params.append('location', filters.location.trim());
    if (filters.propertyType) params.append('propertyType', filters.propertyType.trim());
    if (filters.ownerId) params.append('ownerId', filters.ownerId.trim());
    if (filters.minPrice !== undefined && filters.minPrice !== '') params.append('minPrice', filters.minPrice);
    if (filters.maxPrice !== undefined && filters.maxPrice !== '') params.append('maxPrice', filters.maxPrice);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request(`/properties${queryString}`, { method: 'GET' });

    const rawList = Array.isArray(res.data) ? res.data : [];
    return rawList.map(p => this.normalizeProperty(p));
  },

  /**
   * Fetch a single property by its MongoDB ID
   * @param {string} id 24-character hexadecimal MongoDB ObjectId
   * @returns {Promise<Object>} Normalized property object
   */
  async getPropertyById(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Property ID is required');
    }

    const res = await this.request(`/properties/${encodeURIComponent(id.trim())}`, { method: 'GET' });
    return this.normalizeProperty(res.data);
  },

  /**
   * Update an existing property by its MongoDB ID
   * @param {string} id 24-character hex MongoDB ObjectId
   * @param {Object} propertyData Fields to update (e.g. { pricePerNight: 3500 })
   * @returns {Promise<Object>} Normalized updated property object
   */
  async updateProperty(id, propertyData) {
    if (!id || typeof id !== 'string') {
      throw new Error('Property ID is required');
    }
    if (!propertyData || typeof propertyData !== 'object') {
      throw new Error('Property update data must be an object');
    }

    const res = await this.request(`/properties/${encodeURIComponent(id.trim())}`, {
      method: 'PUT',
      body: JSON.stringify(propertyData)
    });

    return this.normalizeProperty(res.data);
  },

  /**
   * Create a new rental property listing on the backend
   * @param {Object} propertyData Property fields: { title, description, location, propertyType, pricePerNight, bedrooms, bathrooms, image, ownerId, amenities }
   * @returns {Promise<Object>} Created and normalized property object
   */
  async createProperty(propertyData) {
    if (!propertyData || typeof propertyData !== 'object') {
      throw new Error('Property payload is required');
    }

    const res = await this.request('/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData)
    });

    return this.normalizeProperty(res.data);
  },

  /**
   * Delete a rental property listing by its MongoDB ID
   * @param {string} id 24-character hex MongoDB ObjectId
   * @returns {Promise<Object>} Deletion confirmation response
   */
  async deleteProperty(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Property ID is required');
    }

    return await this.request(`/properties/${encodeURIComponent(id.trim())}`, {
      method: 'DELETE'
    });
  },

  // =========================================================================
  // Booking Operations
  // =========================================================================

  /**
   * Submit a new booking reservation to MongoDB Atlas
   * Note: Server-side pricing strictly enforces totalPrice based on property rate and nights.
   * @param {Object} bookingData { propertyId, customerId, checkIn, checkOut, guests }
   * @returns {Promise<Object>} Created and normalized booking object
   */
  async createBooking(bookingData) {
    if (!bookingData || typeof bookingData !== 'object') {
      throw new Error('Booking payload is required');
    }

    const payload = {
      propertyId: bookingData.propertyId || bookingData.property?._id || bookingData.property?.id,
      customerId: bookingData.customerId,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      guests: Number(bookingData.guests || 1)
    };

    const res = await this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!res || !res.success || !res.data) {
      throw new Error((res && res.message) || 'Failed to create booking on the server');
    }

    const normalized = this.normalizeBooking(res.data);
    if (!normalized || (!normalized.id && !normalized._id)) {
      throw new Error('Server response did not contain a valid booking confirmation');
    }

    return normalized;
  },

  /**
   * Retrieve bookings with optional filters (customerId, propertyId, status)
   * @param {Object} [filters] Query filters: { customerId, propertyId, status }
   * @returns {Promise<Array>} Array of normalized booking objects
   */
  async getBookings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.customerId) params.append('customerId', filters.customerId.trim());
    if (filters.propertyId) params.append('propertyId', filters.propertyId.trim());
    if (filters.status) params.append('status', filters.status.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request(`/bookings${queryString}`, { method: 'GET' });

    const rawList = Array.isArray(res.data) ? res.data : [];
    return rawList.map(b => this.normalizeBooking(b));
  },

  /**
   * Update booking status to 'Confirmed' or 'Rejected'
   * @param {string} id 24-character hex MongoDB ObjectId of the booking
   * @param {string} status Must be 'Confirmed' or 'Rejected'
   * @returns {Promise<Object>} Updated and normalized booking object
   */
  async updateBookingStatus(id, status) {
    if (!id || typeof id !== 'string') {
      throw new Error('Booking ID is required');
    }
    if (!status || !['Confirmed', 'Rejected'].includes(status)) {
      throw new Error('Status can only be updated to "Confirmed" or "Rejected"');
    }

    const res = await this.request(`/bookings/${encodeURIComponent(id.trim())}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    return this.normalizeBooking(res.data);
  },

  // =========================================================================
  // Dynamic Pricing Operations
  // =========================================================================

  /**
   * Calculate a dynamic price quote recommendation for a property and date span
   * @param {string} propertyId 24-character hex MongoDB ObjectId
   * @param {string} checkIn Check-in date in YYYY-MM-DD format
   * @param {string} checkOut Check-out date in YYYY-MM-DD format
   * @param {Object} [queryParams] Optional demand/occupancy overrides for simulation
   * @returns {Promise<Object>} Dynamic pricing quote breakdown with multipliers and explanations
   */
  async getPricingQuote(propertyId, checkIn, checkOut, queryParams = {}) {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID is required');
    }
    if (!checkIn || !checkOut) {
      throw new Error('Both checkIn and checkOut dates are required');
    }

    const params = new URLSearchParams({
      checkIn: checkIn.trim(),
      checkOut: checkOut.trim()
    });

    if (queryParams && typeof queryParams === 'object') {
      if (queryParams.occupancyRate !== undefined) params.append('occupancyRate', queryParams.occupancyRate);
      if (queryParams.demandScore !== undefined) params.append('demandScore', queryParams.demandScore);
    }

    const res = await this.request(`/pricing/${encodeURIComponent(propertyId.trim())}?${params.toString()}`, {
      method: 'GET'
    });

    return {
      ...(res.data || {}),
      isSuggestion: res.isSuggestion !== undefined ? res.isSuggestion : true,
      notice: res.notice || ''
    };
  },

  /**
   * Approve a recommended dynamic price for a property
   * Persists approved price to MongoDB Atlas as currentPrice while keeping basePrice intact
   * @param {string} propertyId 24-character hex MongoDB ObjectId
   * @param {number} approvedPrice The price approved by the owner
   * @param {string} [quoteId] Optional ID of the quote being approved
   * @returns {Promise<Object>} Updated property confirmation details
   */
  async approvePrice(propertyId, approvedPrice, quoteId = null) {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID is required');
    }
    const priceNum = Number(approvedPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error('Approved price must be a positive number');
    }

    const payload = { approvedPrice: priceNum };
    if (quoteId) payload.quoteId = quoteId;

    const res = await this.request(`/pricing/${encodeURIComponent(propertyId.trim())}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return res.data;
  },

  /**
   * Retrieve saved dynamic pricing calculation history for a property
   * @param {string} propertyId 24-character hex MongoDB ObjectId
   * @param {number} [limit=50] Maximum number of records to retrieve
   * @returns {Promise<Array>} Array of historical quote records
   */
  async getPricingHistory(propertyId, limit = 50) {
    if (!propertyId || typeof propertyId !== 'string') {
      throw new Error('Property ID is required');
    }

    const res = await this.request(
      `/pricing/${encodeURIComponent(propertyId.trim())}/history?limit=${Math.max(1, limit)}`,
      { method: 'GET' }
    );

    return Array.isArray(res.data) ? res.data : [];
  },

  // =========================================================================
  // Authentication & Token Operations
  // =========================================================================

  /**
   * Retrieve active authentication JWT token from session storage
   * @returns {string|null}
   */
  getToken() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const token = sessionStorage.getItem('token');
        if (token) return token;
        const userRaw = sessionStorage.getItem('currentUser');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user && user.token) return user.token;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return null;
  },

  /**
   * Save or clear authentication JWT token in session storage
   * @param {string|null} token 
   */
  setToken(token) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (token) {
          sessionStorage.setItem('token', token);
        } else {
          sessionStorage.removeItem('token');
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  },

  /**
   * Register a new user account (Customer or Owner) via POST /api/auth/register
   * @param {Object} userData { name, email, password, role }
   * @returns {Promise<Object>} { success, message, token, user }
   */
  async register(userData) {
    if (!userData || typeof userData !== 'object') {
      throw new Error('Registration payload is required');
    }
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  /**
   * Authenticate user credentials via POST /api/auth/login
   * @param {Object} credentials { email, password, role }
   * @returns {Promise<Object>} { success, message, token, user }
   */
  async login(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Login credentials are required');
    }
    return await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  /**
   * Retrieve current authenticated user profile via GET /api/auth/me
   * @returns {Promise<Object>} { success, user }
   */
  async getMe() {
    return await this.request('/auth/me', {
      method: 'GET'
    });
  }
};

// Expose on global window object for browser scripts
if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
}

// Support CommonJS export for automated Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
}
