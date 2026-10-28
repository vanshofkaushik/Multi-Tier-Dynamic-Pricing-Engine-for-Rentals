/**
 * DynamicRent - Owner Module: Booking Management (js/owner/ownerBookings.js)
 * Step 3A: Connects the Owner Bookings management page to the Express backend & MongoDB Atlas.
 * 
 * ARCHITECTURAL REQUIREMENTS:
 * - Fetches real bookings using ApiClient.getBookings().
 * - Uses current owner session to identify which bookings belong to this owner's properties.
 * - Dynamically populates property filter from backend properties owned by this owner.
 * - Displays property name, customer ID/details, stay dates, guest count, total price, and real status.
 * - Connects Confirm and Reject buttons to ApiClient.updateBookingStatus(id, status) with exact backend values ('Confirmed', 'Rejected').
 * - Refreshes the booking list on successful update, and shows clear errors on failure while preserving actual server status.
 * - Provides loading, empty, and API-error states with retry capability.
 * - Maintains white-and-green design, filters, cards, and modal inspection.
 * - Strictly avoids modifying database records during read-only inspection/testing.
 */

let currentOwner = null;
let allOwnerBookings = [];
let ownerProperties = [];
let ownerPropertyIds = new Set();
let pendingRejectBookingId = null;
let listenersBound = false;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initOwnerBookings();
  });
}

/**
 * Initialize Owner Bookings view, verify role, fetch data from backend, and render
 */
async function initOwnerBookings() {
  const loadingEl = document.getElementById('owner-loading-state');
  const errorEl = document.getElementById('owner-api-error-state');
  const noBookingsEl = document.getElementById('owner-no-bookings');
  const noFilteredEl = document.getElementById('owner-no-filtered-bookings');
  const containerEl = document.getElementById('owner-bookings-container');
  const resultsCountEl = document.getElementById('filter-results-count');

  try {
    // 1. Ensure seed users are initialized in localStorage if available
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    // 2. Fetch authenticated owner from session (fallback to default demo owner OWN001)
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      currentOwner = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      currentOwner = getCurrentUser();
    }

    // Fallback if running directly or demo owner
    if (!currentOwner || currentOwner.role !== 'owner') {
      const users = typeof StorageUtils !== 'undefined' && typeof StorageUtils.getUsers === 'function'
        ? StorageUtils.getUsers()
        : (typeof DEFAULT_DEMO_USERS !== 'undefined' ? DEFAULT_DEMO_USERS : []);
      const demoOwner = users.find(u => u.role === 'owner');
      if (demoOwner) {
        currentOwner = demoOwner;
      }
    }

    if (!currentOwner || currentOwner.role !== 'owner') {
      console.warn('[OwnerBookings] Owner session missing or role invalid. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
        return;
      }
    }

    // Update Header profile display
    const nameEl = document.getElementById('owner-name-display');
    if (nameEl) nameEl.textContent = currentOwner.name || 'Owner';

    const avatarEl = document.getElementById('owner-avatar');
    if (avatarEl && currentOwner.name) {
      const initials = currentOwner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || 'O';
    }

    // 3. Set loading UI state
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (noBookingsEl) noBookingsEl.style.display = 'none';
    if (noFilteredEl) noFilteredEl.style.display = 'none';
    if (containerEl) {
      containerEl.style.display = 'none';
      containerEl.innerHTML = '';
    }
    if (resultsCountEl) resultsCountEl.textContent = 'Loading requests...';

    // Clear stale database-dependent stats before making requests
    const pCountEl = document.getElementById('stat-pending-count');
    const cCountEl = document.getElementById('stat-confirmed-count');
    const rCountEl = document.getElementById('stat-revenue-count');
    const tCountEl = document.getElementById('stat-total-count');
    if (pCountEl) pCountEl.textContent = '--';
    if (cCountEl) cCountEl.textContent = '--';
    if (rCountEl) rCountEl.textContent = '--';
    if (tCountEl) tCountEl.textContent = '--';

    // 4. Ensure ApiClient is available
    if (!window.ApiClient || typeof window.ApiClient.getBookings !== 'function') {
      throw new Error('ApiClient is not loaded or missing getBookings method. Please ensure js/utils/api.js is included.');
    }

    // 5. Fetch owner properties to know all property IDs owned by this owner
    await fetchOwnerProperties();

    // 6. Bind filter listeners (once)
    bindFilterListeners();

    // 7. Fetch bookings from backend and render
    await loadAndRenderBookings();

  } catch (err) {
    console.error('[OwnerBookings Properties Source: None - Backend Offline/Error]', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (containerEl) {
      containerEl.style.display = 'none';
      containerEl.innerHTML = '';
    }
    const pCountEl = document.getElementById('stat-pending-count');
    const cCountEl = document.getElementById('stat-confirmed-count');
    const rCountEl = document.getElementById('stat-revenue-count');
    const tCountEl = document.getElementById('stat-total-count');
    if (pCountEl) pCountEl.textContent = '--';
    if (cCountEl) cCountEl.textContent = '--';
    if (rCountEl) rCountEl.textContent = '--';
    if (tCountEl) tCountEl.textContent = '--';
    if (resultsCountEl) resultsCountEl.textContent = 'Server connection unavailable';
    if (noBookingsEl) noBookingsEl.style.display = 'none';
    if (noFilteredEl) noFilteredEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const titleEl = document.getElementById('owner-api-error-title');
      if (titleEl) {
        titleEl.textContent = 'Unable to connect to the server. Please try again.';
      }
      const msgEl = document.getElementById('owner-api-error-message');
      if (msgEl) {
        msgEl.textContent = 'Unable to connect to the server. Please try again.';
      }
    }
    showNotification('Unable to connect to the server. Please try again.', 'error');
  }
}

/**
 * Fetch owner's properties from backend to populate filters and match unpopulated bookings
 */
async function fetchOwnerProperties() {
  ownerProperties = [];
  ownerPropertyIds = new Set();

  const ownerId = currentOwner ? (currentOwner.id || currentOwner._id) : 'OWN001';

  if (!window.ApiClient || typeof window.ApiClient.getProperties !== 'function') {
    throw new Error('Unable to connect to the server. Please try again.');
  }

  console.log('[OwnerBookings Properties Source: Requesting from backend API...]');
  const props = await window.ApiClient.getProperties({ ownerId });
  if (Array.isArray(props)) {
    ownerProperties = props.filter(p => String(p.ownerId).trim() === String(ownerId).trim());
    console.log(`[OwnerBookings Properties Source: Backend API returned ${ownerProperties.length} properties]`, ownerProperties);
  }

  // Populate Set of IDs for quick lookup
  ownerProperties.forEach(p => {
    if (p._id) ownerPropertyIds.add(String(p._id));
    if (p.id) ownerPropertyIds.add(String(p.id));
  });

  populatePropertyFilter();
}

/**
 * Populate property dropdown filter with properties owned by this owner
 */
function populatePropertyFilter() {
  const propertySelect = document.getElementById('owner-property-filter');
  if (!propertySelect) return;

  const currentValue = propertySelect.value;
  propertySelect.innerHTML = '<option value="all">All Properties</option>';

  ownerProperties.forEach(prop => {
    const propId = prop._id || prop.id;
    const propTitle = prop.title || prop.name || 'Untitled Property';
    const option = document.createElement('option');
    option.value = propId;
    option.textContent = propTitle;
    propertySelect.appendChild(option);
  });

  // Also include properties from any bookings already loaded that might not be in ownerProperties
  allOwnerBookings.forEach(b => {
    if (b.propertyId && typeof b.propertyId === 'object') {
      const propId = String(b.propertyId._id || b.propertyId.id || '');
      const propTitle = b.propertyId.title || b.propertyId.name;
      if (propId && propTitle && !ownerPropertyIds.has(propId)) {
        ownerPropertyIds.add(propId);
        const option = document.createElement('option');
        option.value = propId;
        option.textContent = propTitle;
        propertySelect.appendChild(option);
      }
    }
  });

  if (currentValue && propertySelect.querySelector(`option[value="${currentValue}"]`)) {
    propertySelect.value = currentValue;
  }
}

/**
 * Fetch bookings from backend using ApiClient.getBookings(), filter by owner, and render
 */
async function loadAndRenderBookings() {
  const loadingEl = document.getElementById('owner-loading-state');
  const errorEl = document.getElementById('owner-api-error-state');

  try {
    const ownerId = currentOwner ? String(currentOwner.id || currentOwner._id) : 'OWN001';

    // 1. Fetch real bookings from backend
    const rawBookings = await window.ApiClient.getBookings();
    const list = Array.isArray(rawBookings) ? rawBookings : [];

    // 2. Filter bookings that belong to this owner's properties
    allOwnerBookings = list.filter(b => {
      if (!b) return false;

      // Check if propertyId was populated with ownerId
      if (b.propertyId && typeof b.propertyId === 'object') {
        if (b.propertyId.ownerId && String(b.propertyId.ownerId).trim() === ownerId.trim()) {
          return true;
        }
        const pId = String(b.propertyId._id || b.propertyId.id || '');
        if (pId && ownerPropertyIds.has(pId)) {
          return true;
        }
      }

      // Check if unpopulated propertyId matches owner's property IDs
      if (typeof b.propertyId === 'string' && ownerPropertyIds.has(b.propertyId.trim())) {
        return true;
      }

      // Check if booking has direct ownerId attribute
      if (b.ownerId && String(b.ownerId).trim() === ownerId.trim()) {
        return true;
      }

      return false;
    });

    // Hide loading & error states
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    // Refresh property dropdown if bookings revealed additional properties
    populatePropertyFilter();

    // 3. Update summary KPI counters
    updateSummaryKpis(allOwnerBookings);

    // 4. Apply active filters and render cards
    applyFiltersAndRender();

  } catch (err) {
    console.error('[OwnerBookings] Error loading bookings from backend:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('owner-api-error-message');
      if (msgEl) {
        msgEl.textContent = err.message || 'Could not retrieve booking requests from the DynamicRent backend.';
      }
    }
    showNotification(err.message || 'Failed to load bookings from backend.', 'error');
  }
}

/**
 * Update the 4 dynamic summary KPI cards
 * @param {Array} bookings 
 */
function updateSummaryKpis(bookings) {
  const pendingCount = bookings.filter(b => (b.status || 'Pending').toLowerCase() === 'pending').length;
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
  const statusVal = statusFilter ? statusFilter.value.toLowerCase() : 'pending';
  const propertyVal = propertyFilter ? propertyFilter.value : 'all';
  const sortVal = sortSelect ? sortSelect.value : 'newest';

  // 1. Filter
  let filtered = allOwnerBookings.filter(b => {
    // Status filter
    const bStatus = (b.status || 'Pending').toLowerCase();
    if (statusVal !== 'all' && bStatus !== statusVal) {
      return false;
    }

    // Property filter
    if (propertyVal !== 'all') {
      const bPropId = b.propertyId && typeof b.propertyId === 'object'
        ? String(b.propertyId._id || b.propertyId.id || '')
        : String(b.propertyId || '');
      if (bPropId !== propertyVal) {
        return false;
      }
    }

    // Search query matching
    if (query) {
      const cust = getCustomerDisplay(b);
      const matchCustName = (cust.name || '').toLowerCase().includes(query);
      const matchCustEmail = (cust.email || '').toLowerCase().includes(query);
      const matchCustId = (cust.id || '').toLowerCase().includes(query);
      const propTitle = (b.propertyId && (b.propertyId.title || b.propertyId.name)) || b.propertyName || '';
      const matchProp = propTitle.toLowerCase().includes(query);
      const propLoc = (b.propertyId && b.propertyId.location) || b.propertyLocation || '';
      const matchLoc = propLoc.toLowerCase().includes(query);
      const bookingId = String(b._id || b.id || '').toLowerCase();
      const matchId = bookingId.includes(query);

      if (!matchCustName && !matchCustEmail && !matchCustId && !matchProp && !matchLoc && !matchId) {
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
        } else if (statusVal === 'confirmed') {
          emptyFilterTitle.textContent = 'No confirmed bookings found.';
        } else if (statusVal === 'rejected') {
          emptyFilterTitle.textContent = 'No rejected bookings found.';
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

  const bookingId = String(booking._id || booking.id || '');
  const shortId = bookingId.length > 8 ? bookingId.slice(-6).toUpperCase() : bookingId;

  // Property details with fallback
  const prop = booking.propertyId && typeof booking.propertyId === 'object' ? booking.propertyId : null;
  const propTitle = (prop && (prop.title || prop.name)) || booking.propertyName || 'Property Reservation';
  const propImage = (prop && prop.image) || booking.propertyImage || fallbackImg;
  const propLocation = (prop && prop.location) || booking.propertyLocation || '';

  // Dates & nights
  const checkInFormatted = formatDisplayDate(booking.checkIn);
  const checkOutFormatted = formatDisplayDate(booking.checkOut);
  const datesText = `${checkInFormatted} → ${checkOutFormatted}`;

  let nights = 1;
  if (booking.checkIn && booking.checkOut) {
    const dIn = new Date(booking.checkIn);
    const dOut = new Date(booking.checkOut);
    if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut > dIn) {
      nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  // Rate and total price
  const pricePerNight = (prop && prop.pricePerNight) 
    || booking.pricePerNight 
    || (nights > 0 ? Math.round((booking.totalPrice || 0) / nights) : 0);
  const rateFormatted = pricePerNight.toLocaleString('en-IN');
  const totalPriceFormatted = (booking.totalPrice || 0).toLocaleString('en-IN');

  // Customer display
  const cust = getCustomerDisplay(booking);

  // Status and badge
  const rawStatus = booking.status || 'Pending';
  const status = rawStatus.toLowerCase();
  const statusBadge = getStatusBadge(rawStatus);

  // Creation date
  const createdDate = formatDisplayDate(booking.createdAt);

  // Action buttons section based on status
  let actionButtonsHtml = '';
  if (status === 'pending') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${bookingId}')">
        View Details
      </button>
      <button type="button" class="btn btn-success btn-sm" onclick="confirmBooking('${bookingId}')">
        Confirm
      </button>
      <button type="button" class="btn btn-danger btn-sm" onclick="rejectBooking('${bookingId}')">
        Reject
      </button>
    `;
  } else if (status === 'confirmed') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${bookingId}')">
        View Details
      </button>
      <span class="badge badge-success" style="padding: 8px 14px; text-transform: none; font-size: 0.86rem; font-weight: 600;">
        ✓ Confirmed
      </span>
    `;
  } else if (status === 'rejected') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${bookingId}')">
        View Details
      </button>
      <span class="badge badge-danger" style="padding: 8px 14px; text-transform: none; font-size: 0.86rem; font-weight: 600;">
        ✕ Rejected
      </span>
    `;
  } else if (status === 'cancelled') {
    actionButtonsHtml = `
      <button type="button" class="btn btn-outline btn-sm" onclick="viewBookingDetails('${bookingId}')">
        View Details
      </button>
      <span class="badge badge-secondary" style="padding: 8px 14px; text-transform: none; font-size: 0.86rem; font-weight: 600;">
        ⚪ Cancelled
      </span>
    `;
  }

  return `
    <div class="card request-card" id="request-${bookingId}">
      <div class="request-card-hero">
        <img 
          src="${propImage}" 
          alt="${propTitle}"
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="request-id-badge" title="MongoDB Booking ID: ${bookingId}">#${shortId}</span>
      </div>

      <div class="request-content">
        <div class="request-header">
          <div>
            <h3 class="request-property-title">${propTitle}</h3>
            ${propLocation ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">📍 ${propLocation}</div>` : ''}
            <div class="request-customer-info">
              <span>👤 ${cust.name} <small style="color: var(--text-muted); font-size: 0.78rem;">(${cust.id})</small></span>
              <span class="request-email">✉ ${cust.email}</span>
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
            <div class="request-meta-val">${booking.guests || 1} Guests • ${nights} Nights</div>
          </div>
          <div>
            <div class="request-meta-label">Rate Snapshot</div>
            <div class="request-meta-val">₹${rateFormatted} / night</div>
          </div>
          <div>
            <div class="request-meta-label">Total Payout</div>
            <div class="request-meta-val price-highlight">₹${totalPriceFormatted}</div>
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
  const s = (status || 'Pending').toLowerCase();
  switch (s) {
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
 * Confirm a pending booking via backend API with double-action protection
 * @param {string} bookingId 
 */
async function confirmBooking(bookingId) {
  if (!currentOwner) {
    showNotification('Please log in as an owner.', 'error');
    return;
  }

  const booking = allOwnerBookings.find(b => (b._id === bookingId || b.id === bookingId));
  if (!booking) {
    showNotification('Booking not found.', 'error');
    return;
  }

  // Find card action buttons to disable during request
  const cardEl = document.getElementById(`request-${bookingId}`);
  const buttons = cardEl ? cardEl.querySelectorAll('button') : [];
  buttons.forEach(btn => btn.disabled = true);

  try {
    // Call backend API with EXACT status value 'Confirmed'
    const updated = await window.ApiClient.updateBookingStatus(bookingId, 'Confirmed');

    showNotification(`Booking confirmed successfully!`, 'success');
    closeBookingDetailsModal();

    // Refresh booking list from backend to maintain single source of truth
    await loadAndRenderBookings();

  } catch (err) {
    console.error('[OwnerBookings] Failed to confirm booking:', err);
    showNotification(err.message || 'Failed to confirm booking on the server.', 'error');
    // Re-enable buttons and preserve server state
    buttons.forEach(btn => btn.disabled = false);
    applyFiltersAndRender();
  }
}

/**
 * Open confirmation modal before rejecting a booking
 * @param {string} bookingId 
 */
function rejectBooking(bookingId) {
  if (!currentOwner) {
    showNotification('Please log in as an owner.', 'error');
    return;
  }

  const booking = allOwnerBookings.find(b => (b._id === bookingId || b.id === bookingId));
  if (!booking) {
    showNotification('Booking not found.', 'error');
    return;
  }

  pendingRejectBookingId = bookingId;
  const modalEl = document.getElementById('owner-reject-confirm-modal');
  const custNameEl = document.getElementById('reject-modal-customer-name');
  const confirmBtn = document.getElementById('btn-modal-confirm-reject');

  const cust = getCustomerDisplay(booking);
  const propTitle = (booking.propertyId && (booking.propertyId.title || booking.propertyId.name)) || booking.propertyName || 'Property';

  if (custNameEl) {
    custNameEl.textContent = `${cust.name} (${propTitle})`;
  }

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Reject Booking';
    confirmBtn.onclick = () => executeRejectBooking(bookingId);
  }

  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

/**
 * Execute actual rejection via backend API after owner confirms in modal
 * @param {string} bookingId 
 */
async function executeRejectBooking(bookingId) {
  if (!currentOwner || !bookingId) return;

  const confirmBtn = document.getElementById('btn-modal-confirm-reject');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Rejecting...';
  }

  try {
    // Call backend API with EXACT status value 'Rejected'
    const updated = await window.ApiClient.updateBookingStatus(bookingId, 'Rejected');

    closeRejectConfirmModal();
    closeBookingDetailsModal();

    showNotification(`Booking rejected successfully.`, 'success');

    // Refresh booking list from backend to maintain single source of truth
    await loadAndRenderBookings();

  } catch (err) {
    console.error('[OwnerBookings] Failed to reject booking:', err);
    closeRejectConfirmModal();
    showNotification(err.message || 'Failed to reject booking on the server.', 'error');
    // Preserve actual server status
    applyFiltersAndRender();
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Reject Booking';
    }
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
 * Open the Booking Details Modal with full itinerary breakdown from MongoDB data
 * @param {string} bookingId 
 */
function viewBookingDetails(bookingId) {
  const booking = allOwnerBookings.find(b => (b._id === bookingId || b.id === bookingId));
  if (!booking) {
    showNotification('Booking not found.', 'error');
    return;
  }

  const modalEl = document.getElementById('owner-booking-details-modal');
  if (!modalEl) return;

  const prop = booking.propertyId && typeof booking.propertyId === 'object' ? booking.propertyId : null;
  const propTitle = (prop && (prop.title || prop.name)) || booking.propertyName || 'Property Reservation';
  const propLocation = (prop && prop.location) || booking.propertyLocation || 'Location unavailable';

  const cust = getCustomerDisplay(booking);

  const checkInFormatted = formatDisplayDate(booking.checkIn);
  const checkOutFormatted = formatDisplayDate(booking.checkOut);

  let nights = 1;
  if (booking.checkIn && booking.checkOut) {
    const dIn = new Date(booking.checkIn);
    const dOut = new Date(booking.checkOut);
    if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut > dIn) {
      nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  const pricePerNight = (prop && prop.pricePerNight) 
    || booking.pricePerNight 
    || (nights > 0 ? Math.round((booking.totalPrice || 0) / nights) : 0);

  // Populate modal fields
  const bId = String(booking._id || booking.id || '');
  const idEl = document.getElementById('modal-booking-id');
  if (idEl) {
    idEl.textContent = `#${bId.length > 8 ? bId.slice(-6).toUpperCase() : bId}`;
    idEl.title = `MongoDB ID: ${bId}`;
  }

  const titleEl = document.getElementById('modal-property-name');
  if (titleEl) titleEl.textContent = propTitle;

  const locEl = document.getElementById('modal-property-location');
  if (locEl) locEl.textContent = `📍 ${propLocation}`;

  const custNameEl = document.getElementById('modal-customer-name');
  if (custNameEl) custNameEl.textContent = cust.name;

  const custIdEl = document.getElementById('modal-customer-id');
  if (custIdEl) custIdEl.textContent = cust.id;

  const custEmailEl = document.getElementById('modal-customer-email');
  if (custEmailEl) custEmailEl.textContent = cust.email;

  const datesEl = document.getElementById('modal-dates');
  if (datesEl) datesEl.textContent = `${checkInFormatted} → ${checkOutFormatted}`;

  const guestText = (booking.guests || 1) === 1 ? '1 Guest' : `${booking.guests || 1} Guests`;
  const nightText = nights === 1 ? '1 Night' : `${nights} Nights`;
  const ngEl = document.getElementById('modal-nights-guests');
  if (ngEl) ngEl.textContent = `${nightText} • ${guestText}`;

  const rateEl = document.getElementById('modal-rate');
  if (rateEl) rateEl.textContent = `₹${pricePerNight.toLocaleString('en-IN')} / night`;

  const subtotalEl = document.getElementById('modal-subtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${(booking.totalPrice || 0).toLocaleString('en-IN')}`;

  const totalEl = document.getElementById('modal-total-price');
  if (totalEl) totalEl.textContent = `₹${(booking.totalPrice || 0).toLocaleString('en-IN')}`;

  const createdEl = document.getElementById('modal-created-at');
  if (createdEl) createdEl.textContent = formatDisplayDate(booking.createdAt);

  const rawStatus = booking.status || 'Pending';
  const status = rawStatus.toLowerCase();
  const statusBadge = getStatusBadge(rawStatus);
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
        <button type="button" class="btn btn-danger btn-sm" onclick="rejectBooking('${bId}')">Reject Request</button>
        <button type="button" class="btn btn-success btn-sm" onclick="confirmBooking('${bId}')">Confirm Booking</button>
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
 * Bind input and change events to search and filter inputs
 */
function bindFilterListeners() {
  if (listenersBound) return;
  listenersBound = true;

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
 * Unified notification helper
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} [type] 
 */
function showNotification(message, type = 'success') {
  if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
    Toast.show(message, type);
  } else if (typeof showOwnerToast === 'function') {
    showOwnerToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Format date for display in UK style "27 Oct 2026"
 * @param {string|Date} dateStr 
 * @returns {string}
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const raw = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
    if (typeof DateUtils !== 'undefined' && typeof DateUtils.formatDate === 'function') {
      return DateUtils.formatDate(raw);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Resolve customer display details (name, email, ID) from registered users or fallbacks
 * @param {Object} booking 
 * @returns {{ id: string, name: string, email: string }}
 */
function getCustomerDisplay(booking) {
  const custId = booking.customerId || '';
  let custName = booking.customerName || '';
  let custEmail = booking.customerEmail || '';

  if (custId && (!custName || !custEmail)) {
    try {
      const users = typeof StorageUtils !== 'undefined' && typeof StorageUtils.getUsers === 'function' 
        ? StorageUtils.getUsers() 
        : (typeof DEFAULT_DEMO_USERS !== 'undefined' ? DEFAULT_DEMO_USERS : []);
      const match = users.find(u => u.id === custId || (u.email && u.email.toLowerCase() === custId.toLowerCase()));
      if (match) {
        if (!custName) custName = match.name;
        if (!custEmail) custEmail = match.email;
      }
    } catch (e) {
      console.warn('Error resolving customer details:', e);
    }
  }

  return {
    id: custId || 'N/A',
    name: custName || (custId ? `Guest (${custId})` : 'Guest'),
    email: custEmail || (custId ? `ID: ${custId}` : '--')
  };
}

/**
 * Fallback toast notification matching owner dashboard styling
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

// Support CommonJS export for automated Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initOwnerBookings,
    fetchOwnerProperties,
    populatePropertyFilter,
    loadAndRenderBookings,
    updateSummaryKpis,
    applyFiltersAndRender,
    renderBookingCardHtml,
    getStatusBadge,
    confirmBooking,
    rejectBooking,
    executeRejectBooking,
    viewBookingDetails,
    closeBookingDetailsModal,
    closeRejectConfirmModal,
    resetOwnerFilters,
    getCustomerDisplay,
    formatDisplayDate
  };
}
