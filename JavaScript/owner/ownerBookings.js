/**
 * DynamicRent - Owner Module: Booking Management (js/owner/ownerBookings.js)
 * Manages owner-property authorization, booking confirmation/rejection lifecycles,
 * double-action protection, dynamic KPI counters, multi-criteria filtering, search, and modal details.
 */

let currentOwner = null;
let allOwnerBookings = [];

document.addEventListener('DOMContentLoaded', () => {
  initOwnerBookings();
});

/**
 * Initialize Owner Bookings view, verify role, populate filters, and render data
 */
function initOwnerBookings() {
  try {
    // 1. Ensure property & user datasets are initialized
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    // 2. Fetch authenticated owner from session
    currentOwner = StorageUtils.getCurrentUser();
    if (!currentOwner || currentOwner.role !== 'owner') {
      console.warn('Owner authentication missing. Redirecting to login.');
      redirectToLogin();
      return;
    }

    // Update Header profile
    const nameEl = document.getElementById('owner-name-display');
    if (nameEl) nameEl.textContent = currentOwner.name || 'Owner';

    const avatarEl = document.getElementById('owner-avatar');
    if (avatarEl && currentOwner.name) {
      const initials = currentOwner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || 'O';
    }

    // 3. Populate property dropdown filter with properties owned by this owner
    populatePropertyFilter();

    // 4. Bind search, filter, and sort listeners
    bindFilterListeners();

    // 5. Load and render bookings
    loadAndRenderBookings();

  } catch (err) {
    console.error('Error initializing owner bookings:', err);
    showOwnerToast('Failed to initialize booking requests.', 'error');
  }
}

/**
 * Populate property filter dropdown with owner's properties
 */
function populatePropertyFilter() {
  const propertySelect = document.getElementById('owner-property-filter');
  if (!propertySelect || !currentOwner) return;

  const ownerProperties = StorageUtils.getOwnerProperties(currentOwner.id);

  // Preserve 'All Properties' option
  propertySelect.innerHTML = '<option value="all">All Properties</option>';

  ownerProperties.forEach(prop => {
    const option = document.createElement('option');
    option.value = prop.id;
    option.textContent = prop.name;
    propertySelect.appendChild(option);
  });
}

/**
 * Bind input and change events to search and filter inputs
 */
function bindFilterListeners() {
  const searchInput = document.getElementById('owner-search-input');
  const statusFilter = document.getElementById('owner-status-filter');
  const propertyFilter = document.getElementById('owner-property-filter');
  const sortSelect = document.getElementById('owner-sort-select');
  const resetBtn = document.getElementById('owner-reset-filters');

  if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
  if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
  if (propertyFilter) propertyFilter.addEventListener('change', applyFiltersAndRender);
  if (sortSelect) sortSelect.addEventListener('change', applyFiltersAndRender);
  if (resetBtn) resetBtn.addEventListener('click', resetOwnerFilters);
}

/**
 * Load owner bookings from storage, update summary statistics, and apply current filters
 */
function loadAndRenderBookings() {
  if (!currentOwner) return;

  allOwnerBookings = StorageUtils.getOwnerBookings(currentOwner.id);

  // Update summary KPI counters
  updateSummaryKpis(allOwnerBookings);

  // Apply active search and filter controls
  applyFiltersAndRender();
}

/**
 * Update the 4 dynamic summary KPI cards
 * @param {Array} bookings 
 */
function updateSummaryKpis(bookings) {
  const pendingCount = bookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;
  const confirmedCount = bookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').length;
  const rejectedCount = bookings.filter(b => (b.status || '').toLowerCase() === 'rejected').length;
  const totalCount = bookings.length;

  const pendingEl = document.getElementById('stat-pending-count');
  const confirmedEl = document.getElementById('stat-confirmed-count');
  const rejectedEl = document.getElementById('stat-rejected-count');
  const totalEl = document.getElementById('stat-total-count');

  if (pendingEl) pendingEl.textContent = pendingCount.toString();
  if (confirmedEl) confirmedEl.textContent = confirmedCount.toString();
  if (rejectedEl) rejectedEl.textContent = rejectedCount.toString();
  if (totalEl) totalEl.textContent = totalCount.toString();
}

/**
 * Filter and sort owner bookings based on search box, status, property, and sort order
 */
function applyFiltersAndRender() {
  const searchInput = document.getElementById('owner-search-input');
  const statusFilter = document.getElementById('owner-status-filter');
  const propertyFilter = document.getElementById('owner-property-filter');
  const sortSelect = document.getElementById('owner-sort-select');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const statusVal = statusFilter ? statusFilter.value.toLowerCase() : 'all';
  const propertyVal = propertyFilter ? propertyFilter.value : 'all';
  const sortVal = sortSelect ? sortSelect.value : 'newest';

  // 1. Filter
  let filtered = allOwnerBookings.filter(b => {
    // Status filter
    const bStatus = (b.status || 'pending').toLowerCase();
    if (statusVal !== 'all' && bStatus !== statusVal) {
      return false;
    }

    // Property filter
    if (propertyVal !== 'all' && b.propertyId !== propertyVal) {
      return false;
    }

    // Search query matching: customer name, email, property name, booking ID
    if (query) {
      const matchName = (b.customerName || '').toLowerCase().includes(query);
      const matchEmail = (b.customerEmail || '').toLowerCase().includes(query);
      const matchProp = (b.propertyName || '').toLowerCase().includes(query);
      const matchId = (b.id || '').toLowerCase().includes(query);
      if (!matchName && !matchEmail && !matchProp && !matchId) {
        return false;
      }
    }

    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    if (sortVal === 'newest') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (sortVal === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    } else if (sortVal === 'price-high') {
      return (b.totalPrice || 0) - (a.totalPrice || 0);
    } else if (sortVal === 'price-low') {
      return (a.totalPrice || 0) - (b.totalPrice || 0);
    }
    return 0;
  });

  // 3. Update counter text
  const resultsCountEl = document.getElementById('filter-results-count');
  if (resultsCountEl) {
    const text = filtered.length === 1 ? 'Showing 1 request' : `Showing ${filtered.length} requests`;
    resultsCountEl.textContent = text;
  }

  // 4. Render UI states
  const noBookingsEl = document.getElementById('owner-no-bookings');
  const noFilteredEl = document.getElementById('owner-no-filtered-bookings');
  const containerEl = document.getElementById('owner-bookings-container');
  const emptyFilterTitle = document.getElementById('empty-filter-title');

  if (allOwnerBookings.length === 0) {
    if (noBookingsEl) noBookingsEl.style.display = 'block';
    if (noFilteredEl) noFilteredEl.style.display = 'none';
    if (containerEl) {
      containerEl.style.display = 'none';
      containerEl.innerHTML = '';
    }
    return;
  }

  if (filtered.length === 0) {
    if (noBookingsEl) noBookingsEl.style.display = 'none';
    if (noFilteredEl) {
      noFilteredEl.style.display = 'block';
      if (emptyFilterTitle) {
        if (statusVal === 'pending') {
          emptyFilterTitle.textContent = 'No pending booking requests.';
        } else {
          emptyFilterTitle.textContent = 'No bookings match your filters.';
        }
      }
    }
    if (containerEl) {
      containerEl.style.display = 'none';
      containerEl.innerHTML = '';
    }
    return;
  }

  if (noBookingsEl) noBookingsEl.style.display = 'none';
  if (noFilteredEl) noFilteredEl.style.display = 'none';
  if (containerEl) {
    containerEl.style.display = 'grid';
    containerEl.innerHTML = filtered.map(renderBookingCardHtml).join('');
  }
}

/**
 * Generate HTML string for an individual booking request card
 * @param {Object} booking 
 * @returns {string} HTML markup
 */
function renderBookingCardHtml(booking) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  const checkInFormatted = DateUtils.formatDate(booking.checkIn);
  const checkOutFormatted = DateUtils.formatDate(booking.checkOut);
  const datesText = `${checkInFormatted} → ${checkOutFormatted}`;

  const status = (booking.status || 'pending').toLowerCase();
  const statusBadge = getStatusBadge(status);

  const pricePerNight = (booking.pricePerNight || 0).toLocaleString('en-IN');
  const totalPrice = (booking.totalPrice || 0).toLocaleString('en-IN');
  const createdDate = DateUtils.formatDate(booking.createdAt ? booking.createdAt.split('T')[0] : '');

  // Action button section based on status
  let actionButtonsHtml = '';
  if (status === 'pending') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${booking.id}')">
        View Details
      </button>
      <button type="button" class="btn btn-success btn-sm" onclick="confirmBooking('${booking.id}')">
        Confirm
      </button>
      <button type="button" class="btn btn-danger btn-sm" onclick="rejectBooking('${booking.id}')">
        Reject
      </button>
    `;
  } else if (status === 'confirmed') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${booking.id}')">
        View Details
      </button>
      <span class="badge badge-success" style="padding: 8px 14px; text-transform: none; font-size: 0.86rem; font-weight: 600;">
        ✓ Confirmed
      </span>
    `;
  } else if (status === 'rejected') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${booking.id}')">
        View Details
      </button>
      <span class="badge badge-danger" style="padding: 8px 14px; text-transform: none; font-size: 0.86rem; font-weight: 600;">
        ✕ Rejected
      </span>
    `;
  }

  return `
    <div class="card request-card" id="request-${booking.id}">
      <div class="request-card-hero">
        <img 
          src="${booking.propertyImage || fallbackImg}" 
          alt="${booking.propertyName}"
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="request-id-badge">${booking.id}</span>
      </div>

      <div class="request-content">
        <div class="request-header">
          <div>
            <h3 class="request-property-title">${booking.propertyName}</h3>
            <div class="request-customer-info">
              <span>👤 ${booking.customerName || 'Guest'}</span>
              <span class="request-email">✉ ${booking.customerEmail || ''}</span>
            </div>
          </div>
          <div>
            <span class="badge ${statusBadge.className}">${statusBadge.label}</span>
          </div>
        </div>

        <div class="request-meta-grid">
          <div>
            <div class="request-meta-label">Stay Dates</div>
            <div class="request-meta-val">${datesText}</div>
          </div>
          <div>
            <div class="request-meta-label">Stay Details</div>
            <div class="request-meta-val">${booking.guests || 1} Guests • ${booking.nights || 1} Nights</div>
          </div>
          <div>
            <div class="request-meta-label">Rate Snapshot</div>
            <div class="request-meta-val">₹${pricePerNight} / night</div>
          </div>
          <div>
            <div class="request-meta-label">Total Payout</div>
            <div class="request-meta-val price-highlight">₹${totalPrice}</div>
          </div>
        </div>

        <div class="request-footer">
          <span class="request-created-at">Requested on ${createdDate}</span>
          <div class="request-actions-strip">
            ${actionButtonsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Determine badge class and label for booking status
 * @param {string} status 
 * @returns {{ className: string, label: string }}
 */
function getStatusBadge(status) {
  switch (status) {
    case 'confirmed':
      return { className: 'badge-success', label: '🟢 Confirmed' };
    case 'rejected':
      return { className: 'badge-danger', label: '🔴 Rejected' };
    case 'cancelled':
      return { className: 'badge-secondary', label: '⚪ Cancelled' };
    case 'pending':
    default:
      return { className: 'badge-warning', label: '🟡 Pending' };
  }
}

/**
 * Confirm a pending booking with authorization and double-action protection
 * @param {string} bookingId 
 */
function confirmBooking(bookingId) {
  if (!currentOwner) {
    if (typeof Toast !== 'undefined') Toast.error('Please log in as an owner.');
    else showOwnerToast('Please log in as an owner.', 'error');
    return;
  }

  const result = StorageUtils.updateBookingStatus(bookingId, 'confirmed', currentOwner.id);

  if (result.success) {
    if (typeof Toast !== 'undefined') Toast.success(result.message);
    else showOwnerToast(result.message, 'success');
    closeBookingDetailsModal();
    loadAndRenderBookings();
  } else {
    if (typeof Toast !== 'undefined') Toast.error(result.message);
    else showOwnerToast(result.message, 'error');
  }
}

let pendingRejectBookingId = null;

/**
 * Open confirmation modal before rejecting a booking
 * @param {string} bookingId 
 */
function rejectBooking(bookingId) {
  if (!currentOwner) {
    if (typeof Toast !== 'undefined') Toast.error('Please log in as an owner.');
    else showOwnerToast('Please log in as an owner.', 'error');
    return;
  }

  const booking = StorageUtils.getBookingById(bookingId);
  if (!booking) {
    if (typeof Toast !== 'undefined') Toast.error('Booking not found.');
    else showOwnerToast('Booking not found.', 'error');
    return;
  }

  pendingRejectBookingId = bookingId;
  const modalEl = document.getElementById('owner-reject-confirm-modal');
  const custNameEl = document.getElementById('reject-modal-customer-name');
  const confirmBtn = document.getElementById('btn-modal-confirm-reject');

  if (custNameEl) {
    custNameEl.textContent = `${booking.customerName || 'Guest'} (${booking.propertyName})`;
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => executeRejectBooking(bookingId);
  }

  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

/**
 * Execute actual rejection after owner confirms in modal
 * @param {string} bookingId 
 */
function executeRejectBooking(bookingId) {
  if (!currentOwner || !bookingId) return;

  const result = StorageUtils.updateBookingStatus(bookingId, 'rejected', currentOwner.id);

  closeRejectConfirmModal();
  closeBookingDetailsModal();

  if (result.success) {
    if (typeof Toast !== 'undefined') Toast.success(result.message);
    else showOwnerToast(result.message, 'success');
    loadAndRenderBookings();
  } else {
    if (typeof Toast !== 'undefined') Toast.error(result.message);
    else showOwnerToast(result.message, 'error');
  }
}

/**
 * Close the Reject Confirmation Modal
 */
function closeRejectConfirmModal() {
  pendingRejectBookingId = null;
  const modalEl = document.getElementById('owner-reject-confirm-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
}

/**
 * Open the Booking Details Modal with full itinerary breakdown
 * @param {string} bookingId 
 */
function viewBookingDetails(bookingId) {
  const booking = StorageUtils.getBookingById(bookingId);
  if (!booking) {
    showOwnerToast('Booking not found.', 'error');
    return;
  }

  // Authorization check: Verify property belongs to current owner
  const property = StorageUtils.getPropertyById(booking.propertyId);
  if (!property || property.ownerId !== currentOwner.id) {
    showOwnerToast('You are not authorized to view this booking.', 'error');
    return;
  }

  const modalEl = document.getElementById('owner-booking-details-modal');
  if (!modalEl) return;

  // Populate modal fields
  document.getElementById('modal-booking-id').textContent = booking.id;
  document.getElementById('modal-property-name').textContent = booking.propertyName;
  document.getElementById('modal-property-location').textContent = `📍 ${booking.propertyLocation || property.location || 'India'}`;
  document.getElementById('modal-customer-name').textContent = booking.customerName || 'Guest';
  document.getElementById('modal-customer-email').textContent = booking.customerEmail || '--';

  const checkInFormatted = DateUtils.formatDate(booking.checkIn);
  const checkOutFormatted = DateUtils.formatDate(booking.checkOut);
  document.getElementById('modal-dates').textContent = `${checkInFormatted} → ${checkOutFormatted}`;

  const guestText = booking.guests === 1 ? '1 Guest' : `${booking.guests} Guests`;
  const nightText = booking.nights === 1 ? '1 Night' : `${booking.nights} Nights`;
  document.getElementById('modal-nights-guests').textContent = `${nightText} • ${guestText}`;

  document.getElementById('modal-rate').textContent = `₹${(booking.pricePerNight || 0).toLocaleString('en-IN')} / night`;
  document.getElementById('modal-subtotal').textContent = `₹${(booking.subtotal || booking.totalPrice || 0).toLocaleString('en-IN')}`;
  document.getElementById('modal-total-price').textContent = `₹${(booking.totalPrice || 0).toLocaleString('en-IN')}`;

  const createdDate = DateUtils.formatDate(booking.createdAt ? booking.createdAt.split('T')[0] : '');
  document.getElementById('modal-created-at').textContent = createdDate;

  const status = (booking.status || 'pending').toLowerCase();
  const statusBadge = getStatusBadge(status);
  const statusBadgeEl = document.getElementById('modal-status-badge');
  if (statusBadgeEl) {
    statusBadgeEl.textContent = statusBadge.label;
    statusBadgeEl.className = `badge ${statusBadge.className}`;
  }

  // Configure action buttons in modal
  const actionBar = document.getElementById('modal-action-bar');
  if (actionBar) {
    if (status === 'pending') {
      actionBar.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" onclick="closeBookingDetailsModal()">Close</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="rejectBooking('${booking.id}')">Reject Request</button>
        <button type="button" class="btn btn-success btn-sm" onclick="confirmBooking('${booking.id}')">Confirm Booking</button>
      `;
    } else {
      actionBar.innerHTML = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeBookingDetailsModal()">Close</button>
      `;
    }
  }

  modalEl.style.display = 'flex';
}

/**
 * Close the Booking Details Modal
 */
function closeBookingDetailsModal() {
  const modalEl = document.getElementById('owner-booking-details-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
}

/**
 * Reset all filter and search controls to defaults
 */
function resetOwnerFilters() {
  const searchInput = document.getElementById('owner-search-input');
  const statusFilter = document.getElementById('owner-status-filter');
  const propertyFilter = document.getElementById('owner-property-filter');
  const sortSelect = document.getElementById('owner-sort-select');

  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = 'all';
  if (propertyFilter) propertyFilter.value = 'all';
  if (sortSelect) sortSelect.value = 'newest';

  applyFiltersAndRender();
}

/**
 * Display a professional toast notification
 * @param {string} message 
 * @param {string} [type] 'success' | 'error' | 'warning'
 */
function showOwnerToast(message, type = 'success') {
  const container = document.getElementById('owner-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}
