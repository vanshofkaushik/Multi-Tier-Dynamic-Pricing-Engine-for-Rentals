/**
 * DynamicRent - Customer Module: My Bookings (js/customer/myBookings.js)
 * Loads customer-scoped bookings from localStorage, ensures isolation between accounts,
 * renders reservation cards with status badges and price snapshots, and handles empty state.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMyBookings();
});

/**
 * Initialize My Bookings view and render customer's reservations
 */
function initMyBookings() {
  try {
    // 1. Get authenticated customer from session
    const currentUser = StorageUtils.getCurrentUser();
    if (!currentUser || currentUser.role !== 'customer') {
      console.warn('Customer session missing. Redirecting to login.');
      redirectToLogin();
      return;
    }

    // 2. Fetch bookings strictly belonging to this customer
    const userBookings = StorageUtils.getBookingsByCustomer(currentUser.id);

    // 3. Sort bookings by creation date descending (newest first)
    userBookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // 4. Update heading counter
    const countHeading = document.getElementById('my-bookings-count-heading');
    if (countHeading) {
      countHeading.textContent = `All Reservations (${userBookings.length})`;
    }

    // 5. Check empty state vs populated list
    const noBookingsEl = document.getElementById('no-bookings-state');
    const bookingsListEl = document.getElementById('bookings-list-container');

    if (!userBookings || userBookings.length === 0) {
      if (noBookingsEl) noBookingsEl.style.display = 'block';
      if (bookingsListEl) {
        bookingsListEl.style.display = 'none';
        bookingsListEl.innerHTML = '';
      }
      return;
    }

    if (noBookingsEl) noBookingsEl.style.display = 'none';
    if (bookingsListEl) {
      bookingsListEl.style.display = 'grid';
      bookingsListEl.innerHTML = userBookings.map(renderBookingCard).join('');
    }

  } catch (err) {
    console.error('Error initializing My Bookings:', err);
  }
}

/**
 * Generate HTML string for an individual customer booking card
 * @param {Object} booking 
 * @returns {string} HTML markup
 */
function renderBookingCard(booking) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  // Format date range e.g. "25 Aug 2026 → 28 Aug 2026"
  const checkInFormatted = DateUtils.formatDate(booking.checkIn);
  const checkOutFormatted = DateUtils.formatDate(booking.checkOut);
  const dateRangeStr = `${checkInFormatted} → ${checkOutFormatted}`;

  // Price snapshot values
  const pricePerNight = booking.pricePerNight || 0;
  const totalPrice = booking.totalPrice || 0;

  // Status badge styling and text
  const statusInfo = getStatusBadgeInfo(booking.status);

  // Guests & Nights strings
  const guestsText = booking.guests === 1 ? '1 Guest' : `${booking.guests} Guests`;
  const nightsText = booking.nights === 1 ? '1 Night' : `${booking.nights} Nights`;

  return `
    <div class="card booking-item-card">
      <div class="booking-card-media">
        <img 
          src="${booking.propertyImage || fallbackImg}" 
          alt="${booking.propertyName}" 
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="booking-id-pill">${booking.id}</span>
      </div>

      <div class="booking-card-body">
        <div class="booking-card-top">
          <div>
            <h3 class="booking-card-title">${booking.propertyName}</h3>
            <div class="booking-card-location">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${booking.propertyLocation || 'India'}</span>
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
            Requested on ${DateUtils.formatDate(booking.createdAt ? booking.createdAt.split('T')[0] : '')}
          </span>
          <a href="property-details.html?id=${booking.propertyId}" class="btn btn-outline btn-sm">
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
 * @param {string} status 
 * @returns {{ badgeClass: string, label: string }}
 */
function getStatusBadgeInfo(status) {
  const s = (status || 'pending').toLowerCase();
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
