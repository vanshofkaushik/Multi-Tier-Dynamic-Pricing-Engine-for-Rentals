/**
 * DynamicRent - Customer Module: My Bookings (js/customer/myBookings.js)
 * Step 2B: Connects the Customer My Bookings page to the Express backend & MongoDB Atlas.
 * 
 * ARCHITECTURAL REQUIREMENTS:
 * - Fetches real customer reservations using ApiClient.getBookings({ customerId }).
 * - Reads customer session from sessionStorage / StorageUtils with USR_DEMO fallback.
 * - Handles populated and unpopulated propertyId values safely with robust fallbacks.
 * - Provides clear loading, empty, and API-error states with retry capability.
 * - Strictly avoids using localStorage bookings as database records.
 */

let allCustomerBookings = [];
let currentCustomer = null;

document.addEventListener('DOMContentLoaded', () => {
  initMyBookings();
});

/**
 * Initialize My Bookings view and fetch customer reservations from backend
 */
async function initMyBookings() {
  const loadingEl = document.getElementById('loading-indicator');
  const noBookingsEl = document.getElementById('no-bookings-state');
  const errorEl = document.getElementById('api-error-state');
  const bookingsListEl = document.getElementById('bookings-list-container');
  const countHeading = document.getElementById('my-bookings-count-heading');

  try {
    // 1. Get authenticated customer from session
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      currentCustomer = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      currentCustomer = getCurrentUser();
    }

    if (!currentCustomer || currentCustomer.role !== 'customer') {
      console.warn('Customer session missing. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
        return;
      }
    }

    // Determine customer ID (preserving demo account USR_DEMO fallback)
    const customerId = (currentCustomer && (currentCustomer.id || currentCustomer._id)) || 'USR_DEMO';

    // 2. Set loading UI state
    if (loadingEl) loadingEl.style.display = 'block';
    if (noBookingsEl) noBookingsEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (bookingsListEl) {
      bookingsListEl.style.display = 'none';
      bookingsListEl.innerHTML = '';
    }
    if (countHeading) countHeading.textContent = 'Loading Reservations...';

    // 3. Ensure ApiClient is available
    if (!window.ApiClient || typeof window.ApiClient.getBookings !== 'function') {
      throw new Error('API Client is not loaded. Please verify js/utils/api.js is included.');
    }

    // 4. Fetch customer bookings strictly from backend API
    console.log('[MyBookings Source: Requesting customer bookings from backend API...]');
    const bookings = await window.ApiClient.getBookings({ customerId });
    console.log(`[MyBookings Source: Backend API returned ${bookings ? bookings.length : 0} bookings]`);

    // 5. Hide loading indicator
    if (loadingEl) loadingEl.style.display = 'none';

    // 6. Sort bookings descending by creation date (newest first)
    allCustomerBookings = (Array.isArray(bookings) ? bookings : []).sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // 7. Apply status filter and render
    filterBookings();

  } catch (err) {
    console.error('[MyBookings Source: None - Backend Offline/Error]', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (bookingsListEl) bookingsListEl.style.display = 'none';
    if (noBookingsEl) noBookingsEl.style.display = 'none';

    if (errorEl) {
      errorEl.style.display = 'block';
      const titleEl = document.getElementById('api-error-title');
      if (titleEl) {
        titleEl.textContent = 'Unable to connect to the server. Please try again.';
      }
      const msgEl = document.getElementById('api-error-message');
      if (msgEl) {
        msgEl.textContent = 'Unable to connect to the server. Please try again.';
      }
    }

    if (countHeading) {
      countHeading.textContent = 'Reservations Unavailable';
    }
  }
}

/**
 * Filter bookings list by the selected status filter dropdown
 */
function filterBookings() {
  const filterSelect = document.getElementById('status-filter');
  const selectedStatus = filterSelect ? filterSelect.value : 'all';

  let filtered = [...allCustomerBookings];
  if (selectedStatus && selectedStatus !== 'all') {
    filtered = filtered.filter(b => {
      const statusStr = (b.status || 'Pending').toLowerCase();
      return statusStr === selectedStatus.toLowerCase();
    });
  }

  renderBookingsList(filtered, selectedStatus);
}

/**
 * Render bookings list or appropriate empty state into DOM
 * @param {Array} bookings 
 * @param {string} [currentFilter='all']
 */
function renderBookingsList(bookings, currentFilter = 'all') {
  const countHeading = document.getElementById('my-bookings-count-heading');
  const noBookingsEl = document.getElementById('no-bookings-state');
  const bookingsListEl = document.getElementById('bookings-list-container');
  const noBookingsTitle = document.getElementById('no-bookings-title');
  const noBookingsDesc = document.getElementById('no-bookings-desc');
  const noBookingsActionBtn = document.getElementById('no-bookings-action-btn');

  // Update header count text
  if (countHeading) {
    if (currentFilter === 'all') {
      countHeading.textContent = `All Reservations (${bookings.length})`;
    } else {
      countHeading.textContent = `${currentFilter} Reservations (${bookings.length} of ${allCustomerBookings.length})`;
    }
  }

  // Handle empty state (either no bookings at all, or none matching filter)
  if (!bookings || bookings.length === 0) {
    if (bookingsListEl) {
      bookingsListEl.style.display = 'none';
      bookingsListEl.innerHTML = '';
    }
    if (noBookingsEl) {
      noBookingsEl.style.display = 'block';
      if (allCustomerBookings.length === 0) {
        if (noBookingsTitle) noBookingsTitle.textContent = "You don't have any bookings yet.";
        if (noBookingsDesc) noBookingsDesc.textContent = "Discover verified properties with transparent dynamic pricing and make your first reservation.";
        if (noBookingsActionBtn) {
          noBookingsActionBtn.style.display = 'inline-flex';
          noBookingsActionBtn.textContent = 'Explore Properties';
          noBookingsActionBtn.onclick = null;
          noBookingsActionBtn.href = 'properties.html';
        }
      } else {
        if (noBookingsTitle) noBookingsTitle.textContent = `No ${currentFilter} reservations found.`;
        if (noBookingsDesc) noBookingsDesc.textContent = `You do not have any reservations currently marked as ${currentFilter}.`;
        if (noBookingsActionBtn) {
          noBookingsActionBtn.style.display = 'inline-flex';
          noBookingsActionBtn.textContent = 'Show All Reservations';
          noBookingsActionBtn.href = 'javascript:void(0)';
          noBookingsActionBtn.onclick = () => {
            const selectEl = document.getElementById('status-filter');
            if (selectEl) selectEl.value = 'all';
            filterBookings();
          };
        }
      }
    }
    return;
  }

  // Render cards
  if (noBookingsEl) noBookingsEl.style.display = 'none';
  if (bookingsListEl) {
    bookingsListEl.style.display = 'grid';
    bookingsListEl.innerHTML = bookings.map(renderBookingCard).join('');
  }
}

/**
 * Generate HTML string for an individual customer booking card
 * Handles populated and unpopulated propertyId safely without crashing.
 * @param {Object} booking 
 * @returns {string} HTML markup
 */
function renderBookingCard(booking) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  // Safely extract property details whether propertyId is populated object or raw ID string
  const isPopulated = booking.propertyId && typeof booking.propertyId === 'object';
  const propObj = isPopulated ? booking.propertyId : null;

  const propId = (propObj ? (propObj.id || propObj._id) : booking.propertyId) || '';
  const propName = booking.propertyName || (propObj && (propObj.name || propObj.title)) || 'Rental Property';
  const propLocation = booking.propertyLocation || (propObj && propObj.location) || 'Location not specified';
  const propImage = booking.propertyImage || (propObj && propObj.image) || fallbackImg;

  // Format date range e.g. "25 Aug 2026 → 28 Aug 2026"
  let checkInFormatted = 'Not set';
  let checkOutFormatted = 'Not set';
  let nights = booking.nights || 1;

  if (typeof DateUtils !== 'undefined') {
    if (booking.checkIn) checkInFormatted = DateUtils.formatDate(booking.checkIn);
    if (booking.checkOut) checkOutFormatted = DateUtils.formatDate(booking.checkOut);
    if (booking.checkIn && booking.checkOut) {
      nights = DateUtils.calculateNights(booking.checkIn, booking.checkOut);
    }
  } else {
    if (booking.checkIn) checkInFormatted = String(booking.checkIn).split('T')[0];
    if (booking.checkOut) checkOutFormatted = String(booking.checkOut).split('T')[0];
  }
  const dateRangeStr = `${checkInFormatted} → ${checkOutFormatted}`;

  // Price & rate snapshot values
  const totalPrice = Number(booking.totalPrice !== undefined ? booking.totalPrice : 0);
  const pricePerNight = Number(
    booking.pricePerNight !== undefined
      ? booking.pricePerNight 
      : (propObj && propObj.pricePerNight !== undefined 
          ? propObj.pricePerNight 
          : (nights > 0 ? Math.round(totalPrice / nights) : 0))
  );

  // Status badge styling and text
  const statusInfo = getStatusBadgeInfo(booking.status);

  // Guests & Nights strings
  const guestCount = Number(booking.guests || 1);
  const guestsText = guestCount === 1 ? '1 Guest' : `${guestCount} Guests`;
  const nightsText = nights === 1 ? '1 Night' : `${nights} Nights`;

  // Booking display ID
  const displayId = String(booking.id || booking._id || 'BOOKING');
  const shortId = displayId.length > 10 ? displayId.slice(-8).toUpperCase() : displayId;

  // Request creation date
  let createdDateStr = '';
  if (booking.createdAt) {
    const rawDate = String(booking.createdAt).split('T')[0];
    createdDateStr = (typeof DateUtils !== 'undefined' && typeof DateUtils.formatDate === 'function')
      ? DateUtils.formatDate(rawDate)
      : rawDate;
  }

  // View property link: direct to property details if ID exists, else property catalog
  const viewPropertyLink = propId ? `property-details.html?id=${encodeURIComponent(propId)}` : 'properties.html';

  return `
    <div class="card booking-item-card" id="booking-card-${displayId}">
      <div class="booking-card-media">
        <img 
          src="${propImage}" 
          alt="${propName}" 
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="booking-id-pill" title="Booking ID: ${displayId}">#${shortId}</span>
      </div>

      <div class="booking-card-body">
        <div class="booking-card-top">
          <div>
            <h3 class="booking-card-title">${propName}</h3>
            <div class="booking-card-location">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${propLocation}</span>
            </div>
          </div>
          <div>
            <span class="badge ${statusInfo.badgeClass}">${statusInfo.label}</span>
          </div>
        </div>

        <div class="booking-details-strip">
          <div class="booking-detail-item">
            <span class="detail-name">Stay Dates</span>
            <strong class="detail-val">${dateRangeStr}</strong>
          </div>
          <div class="booking-detail-item">
            <span class="detail-name">Duration & Guests</span>
            <strong class="detail-val">${nightsText} • ${guestsText}</strong>
          </div>
          <div class="booking-detail-item">
            <span class="detail-name">Rate Snapshot</span>
            <strong class="detail-val">₹${pricePerNight.toLocaleString('en-IN')}/night</strong>
          </div>
          <div class="booking-detail-item">
            <span class="detail-name">Total Price</span>
            <strong class="detail-val price-highlight">₹${totalPrice.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div class="booking-card-footer">
          <span class="booking-created-text">
            ${createdDateStr ? `Requested on ${createdDateStr}` : 'Reservation request'}
          </span>
          <a href="${viewPropertyLink}" class="btn btn-outline btn-sm">
            <span>View Property</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Determine badge class and icon label for booking status
 * Supports 'Pending', 'Confirmed', 'Rejected', and 'Cancelled'
 * @param {string} status 
 * @returns {{ badgeClass: string, label: string }}
 */
function getStatusBadgeInfo(status) {
  const s = String(status || 'pending').toLowerCase();
  switch (s) {
    case 'confirmed':
      return { badgeClass: 'badge-success', label: '🟢 Confirmed' };
    case 'rejected':
      return { badgeClass: 'badge-danger', label: '🔴 Rejected' };
    case 'cancelled':
      return { badgeClass: 'badge-secondary', label: '⚪ Cancelled' };
    case 'pending':
    default:
      return { badgeClass: 'badge-warning', label: '🟡 Pending' };
  }
}
