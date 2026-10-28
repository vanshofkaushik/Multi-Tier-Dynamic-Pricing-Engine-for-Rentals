/**
 * DynamicRent - Customer Module: Dashboard (js/customer/customerDashboard.js)
 * Computes dashboard statistics from dynamic storage (available properties, pending, confirmed, total bookings)
 * and displays the customer's 3 most recent reservations.
 */

document.addEventListener('DOMContentLoaded', () => {
  initCustomerDashboard();
});

/**
 * Initialize customer dashboard metrics and overview state
 */
async function initCustomerDashboard() {
  const errorBanner = document.getElementById('customer-dashboard-error-banner');
  const errorText = document.getElementById('customer-dashboard-error-text');
  const availEl = document.getElementById('available-properties-count');
  const pendingEl = document.getElementById('pending-bookings-count');
  const confirmedEl = document.getElementById('confirmed-bookings-count');
  const totalEl = document.getElementById('total-bookings-count');
  const recentContainer = document.getElementById('recent-bookings-container');

  if (errorBanner) errorBanner.style.display = 'none';

  try {
    // 1. Fetch authenticated customer from session
    const currentUser = (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function')
      ? StorageUtils.getCurrentUser()
      : (typeof getCurrentUser === 'function' ? getCurrentUser() : null);

    if (!currentUser || currentUser.role !== 'customer') {
      console.warn('Customer session missing. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
      } else {
        window.location.href = '../login.html';
      }
      return;
    }

    if (!window.ApiClient || typeof window.ApiClient.getProperties !== 'function') {
      throw new Error('Unable to connect to the server. Please try again.');
    }

    const customerId = currentUser.id || currentUser._id || 'USR_DEMO';

    // Clear stale database-dependent content before making requests
    if (availEl) availEl.textContent = '--';
    if (pendingEl) pendingEl.textContent = '--';
    if (confirmedEl) confirmedEl.textContent = '--';
    if (totalEl) totalEl.textContent = '--';
    if (recentContainer) {
      recentContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted);">Loading reservations from server...</div>';
    }

    // 2. Fetch live properties and bookings strictly from backend API
    const [properties, userBookings] = await Promise.all([
      window.ApiClient.getProperties(),
      window.ApiClient.getBookings({ customerId })
    ]);

    // 3. Calculate dynamic statistics
    const propList = Array.isArray(properties) ? properties : [];
    console.log('[Properties Source: Backend API (MongoDB Atlas)] Customer Dashboard fetched', propList.length, 'properties from API');
    const availableCount = propList.filter(p => !p.status || p.status === 'available').length;

    if (availEl) availEl.textContent = availableCount.toString();

    const bookingsList = Array.isArray(userBookings) ? userBookings : [];
    const pendingCount = bookingsList.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;
    const confirmedCount = bookingsList.filter(b => (b.status || '').toLowerCase() === 'confirmed').length;
    const totalCount = bookingsList.length;

    if (pendingEl) pendingEl.textContent = pendingCount.toString();
    if (confirmedEl) confirmedEl.textContent = confirmedCount.toString();
    if (totalEl) totalEl.textContent = totalCount.toString();

    // 4. Render Recent Bookings section (Top 3 newest)
    renderRecentBookings(bookingsList);

    console.log(`Customer Dashboard initialized: ${availableCount} available stays, ${totalCount} bookings.`);

  } catch (err) {
    console.log('[Properties Source: None - Backend Offline] Customer Dashboard zero properties due to error:', err.message);
    if (errorBanner) {
      errorBanner.style.display = 'flex';
      if (errorText) errorText.textContent = 'Unable to connect to the server. Please try again.';
    }
    if (availEl) availEl.textContent = '--';
    if (pendingEl) pendingEl.textContent = '--';
    if (confirmedEl) confirmedEl.textContent = '--';
    if (totalEl) totalEl.textContent = '--';
    if (recentContainer) {
      recentContainer.innerHTML = `
        <div class="dashboard-empty-recent" style="text-align: center; padding: 24px;">
          <p style="color: #991b1b; font-weight: 500; margin-bottom: 12px;">Unable to connect to the server. Please try again.</p>
          <button type="button" class="btn btn-primary btn-sm" onclick="initCustomerDashboard()">Retry</button>
        </div>
      `;
    }
  }
}

/**
 * Render up to 3 recent bookings on the dashboard
 * @param {Array} bookings 
 */
function renderRecentBookings(bookings) {
  const container = document.getElementById('recent-bookings-container');
  if (!container) return;

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="dashboard-empty-recent">
        <div style="font-size: 2rem; margin-bottom: 8px;">🏡</div>
        <h4 style="font-size: 1.1rem; margin-bottom: 4px;">No bookings yet.</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 16px;">
          You haven't submitted any reservation requests yet. Start exploring verified properties!
        </p>
        <a href="properties.html" class="btn btn-primary btn-sm">Explore Properties</a>
      </div>
    `;
    return;
  }

  // Sort newest first
  const sorted = [...bookings].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const recent3 = sorted.slice(0, 3);

  container.innerHTML = `
    <div class="recent-bookings-list">
      ${recent3.map(renderRecentBookingRow).join('')}
    </div>
  `;
}

/**
 * Generate HTML string for a single recent booking row
 * @param {Object} booking 
 * @returns {string} HTML markup
 */
function renderRecentBookingRow(booking) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  const checkInFormatted = DateUtils.formatDate(booking.checkIn);
  const checkOutFormatted = DateUtils.formatDate(booking.checkOut);
  const datesText = `${checkInFormatted} → ${checkOutFormatted}`;

  const statusInfo = getDashboardStatusBadge(booking.status);

  return `
    <div class="recent-booking-item">
      <div class="recent-booking-thumb">
        <img 
          src="${booking.propertyImage || fallbackImg}" 
          alt="${booking.propertyName}"
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
      </div>

      <div class="recent-booking-info">
        <div class="recent-booking-title-row">
          <h4 class="recent-booking-title">${booking.propertyName}</h4>
          <span class="badge ${statusInfo.badgeClass}">${statusInfo.label}</span>
        </div>

        <div class="recent-booking-meta">
          <span>📅 ${datesText}</span>
          <span>👥 ${booking.guests || 1} Guests (${booking.nights || 1} Nights)</span>
          <strong class="recent-booking-price">₹${(booking.totalPrice || 0).toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div class="recent-booking-action">
        <a href="my-bookings.html" class="btn btn-outline btn-sm">Details</a>
      </div>
    </div>
  `;
}

/**
 * Determine badge class and text for status on dashboard
 * @param {string} status 
 * @returns {{ badgeClass: string, label: string }}
 */
function getDashboardStatusBadge(status) {
  const s = (status || 'pending').toLowerCase();
  switch (s) {
    case 'confirmed':
      return { badgeClass: 'badge-success', label: 'Confirmed' };
    case 'rejected':
      return { badgeClass: 'badge-danger', label: 'Rejected' };
    case 'cancelled':
      return { badgeClass: 'badge-secondary', label: 'Cancelled' };
    case 'pending':
    default:
      return { badgeClass: 'badge-warning', label: 'Pending' };
  }
}
