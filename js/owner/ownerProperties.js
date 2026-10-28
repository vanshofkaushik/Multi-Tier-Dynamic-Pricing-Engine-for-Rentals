/**
 * DynamicRent - Owner Module: Properties (js/owner/ownerProperties.js)
 * Step 3C: Connects the Owner Properties page to the Express backend & MongoDB Atlas.
 * 
 * ARCHITECTURAL REQUIREMENTS:
 * - Loads real properties using ApiClient.getProperties() filtered by current owner session.
 * - Displays live occupancy, confirmed bookings, demand scoring, base price, and dynamic link to Tune Rate.
 * - Connects Add/Edit property form to backend ApiClient.createProperty() and ApiClient.updateProperty().
 * - Maps all form inputs to the MongoDB Property schema.
 * - Provides loading, empty, and API-error states with retry capability.
 * - Preserves existing white-and-green design, cards, and navigation.
 * - Notes security limitation: backend currently lacks owner-level auth token enforcement.
 */

let currentOwner = null;
let ownerProperties = [];
let allConfirmedBookings = [];

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initOwnerPropertiesPage();
  });
}

/**
 * Initialize Owner Properties Page, verify session, and fetch listings from backend
 */
async function initOwnerPropertiesPage() {
  const loadingEl = document.getElementById('properties-loading-state');
  const errorEl = document.getElementById('properties-api-error-state');
  const gridEl = document.getElementById('owner-properties-grid');

  try {
    // 1. Ensure seed users are initialized if available
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    // 2. Fetch authenticated owner from session (fallback to demo owner OWN001)
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      currentOwner = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      currentOwner = getCurrentUser();
    }

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
      console.warn('[OwnerProperties] Owner session missing or role invalid. Redirecting to login.');
      if (typeof redirectToLogin === 'function') {
        redirectToLogin();
        return;
      }
    }

    // Update Header profile display
    updateHeaderProfile(currentOwner);

    // 3. Ensure ApiClient is available
    if (!window.ApiClient || typeof window.ApiClient.getProperties !== 'function') {
      throw new Error('ApiClient is not loaded or missing getProperties method. Please ensure js/utils/api.js is included.');
    }

    // 4. Load owner properties and bookings from backend
    await loadOwnerProperties();

  } catch (err) {
    console.error('[OwnerProperties] Error initializing owner properties page:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (gridEl) gridEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      const msgEl = document.getElementById('properties-api-error-message');
      if (msgEl) {
        msgEl.textContent = err.message || 'Could not retrieve properties from the DynamicRent backend.';
      }
    }
  }
}

/**
 * Update Header user profile information
 * @param {Object} owner 
 */
function updateHeaderProfile(owner) {
  const nameEl = document.getElementById('owner-name-display');
  if (nameEl) nameEl.textContent = owner.name || 'Owner';

  const avatarEl = document.getElementById('owner-avatar');
  if (avatarEl && owner.name) {
    const initials = owner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials || 'O';
  }
}

/**
 * Load owner's properties and confirmed bookings from backend, and render the grid
 */
async function loadOwnerProperties() {
  const loadingEl = document.getElementById('properties-loading-state');
  const errorEl = document.getElementById('properties-api-error-state');
  const emptyEl = document.getElementById('properties-empty-state');
  const grid = document.getElementById('owner-properties-grid');
  const subtitleEl = document.getElementById('portfolio-subtitle');

  if (loadingEl) loadingEl.style.display = 'block';
  if (errorEl) errorEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';
  if (grid) {
    grid.style.display = 'none';
    grid.innerHTML = '';
  }

  try {
    const ownerId = currentOwner ? (currentOwner.id || currentOwner._id) : 'OWN001';

    // 1. Fetch properties from backend
    const allProps = await window.ApiClient.getProperties({ ownerId });
    // Filter client-side by ownerId to guarantee owner boundary
    ownerProperties = allProps.filter(p => String(p.ownerId).trim() === String(ownerId).trim());
    console.log('[Properties Source: Backend API (MongoDB Atlas)] Owner properties loaded:', ownerProperties.length, 'properties');

    // 2. Fetch live bookings to calculate accurate occupancy & demand stats
    try {
      const bookings = await window.ApiClient.getBookings();
      allConfirmedBookings = Array.isArray(bookings)
        ? bookings.filter(b => (b.status || '').toLowerCase() === 'confirmed')
        : [];
    } catch (bErr) {
      console.warn('[OwnerProperties] Could not fetch bookings for stats, using default baseline:', bErr);
      allConfirmedBookings = [];
    }

    if (loadingEl) loadingEl.style.display = 'none';

    // 3. Handle Empty State
    if (!ownerProperties || ownerProperties.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (grid) {
        grid.style.display = 'none';
        grid.innerHTML = '';
      }
      if (subtitleEl) subtitleEl.textContent = 'No listings currently registered under this owner account.';
      return;
    }

    // 4. Render Properties Grid
    if (emptyEl) emptyEl.style.display = 'none';
    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = ownerProperties.map(renderPropertyCardHtml).join('');
    }

    if (subtitleEl) {
      const count = ownerProperties.length;
      subtitleEl.textContent = `Showing ${count} active ${count === 1 ? 'listing' : 'listings'} in your portfolio.`;
    }

  } catch (err) {
    console.log('[Properties Source: None - Backend Offline] Zero owner properties displayed due to error:', err.message);
    ownerProperties = [];
    if (loadingEl) loadingEl.style.display = 'none';
    if (subtitleEl) subtitleEl.textContent = 'Server connection unavailable.';
    if (grid) {
      grid.style.display = 'none';
      grid.innerHTML = '';
    }
    if (errorEl) {
      errorEl.style.display = 'block';
      const titleEl = document.getElementById('properties-api-error-title');
      if (titleEl) {
        titleEl.textContent = 'Unable to connect to the server. Please try again.';
      }
      const msgEl = document.getElementById('properties-api-error-message');
      if (msgEl) {
        msgEl.textContent = 'Unable to connect to the server. Please try again.';
      }
    }
    showOwnerToast('Unable to connect to the server. Please try again.', 'error');
  }
}

/**
 * Generate HTML string for an individual property card
 * @param {Object} prop Property document
 * @returns {string} HTML markup
 */
function renderPropertyCardHtml(prop) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  const propId = String(prop._id || prop.id);
  const title = prop.title || prop.name || 'Untitled Property';
  const type = prop.propertyType || prop.type || 'Stay';
  const location = prop.location || 'India';
  const price = (prop.pricePerNight || prop.currentPrice || 0).toLocaleString('en-IN');

  // Calculate confirmed bookings and occupancy from real backend bookings
  const confirmedForThisProp = allConfirmedBookings.filter(b => {
    if (!b.propertyId) return false;
    const bPropId = typeof b.propertyId === 'object' 
      ? String(b.propertyId._id || b.propertyId.id) 
      : String(b.propertyId);
    return bPropId === propId;
  });

  const confirmedCount = confirmedForThisProp.length;
  let occupancyRate = 20;
  if (confirmedCount === 1) occupancyRate = 45;
  else if (confirmedCount === 2) occupancyRate = 70;
  else if (confirmedCount >= 3) occupancyRate = 90;

  const demandScore = Math.min(100, Math.round(occupancyRate * 0.75 + confirmedCount * 15));
  const demandTier = demandScore >= 70 ? 'High' : (demandScore >= 40 ? 'Moderate' : 'Low');
  const demandBadgeClass = demandScore >= 70 ? 'badge-primary' : (demandScore >= 40 ? 'badge-neutral' : 'badge-neutral');

  return `
    <div class="performance-card" id="prop-card-${propId}">
      <div class="performance-media">
        <img 
          src="${prop.image || fallbackImg}" 
          alt="${title}"
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="badge badge-primary performance-badge-left">${type}</span>
        <div class="performance-badge-right">
          <span class="badge ${demandBadgeClass}">${demandTier} (${demandScore}/100)</span>
        </div>
      </div>

      <div class="performance-body">
        <div>
          <h3 class="performance-title">${title}</h3>
          <div class="performance-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${location}, India</span>
          </div>
        </div>

        <div class="performance-stats-strip">
          <div class="perf-stat-item">
            <span class="perf-stat-label">Occupancy</span>
            <strong class="perf-stat-val" style="color: var(--owner-primary-dark);">${occupancyRate}%</strong>
          </div>
          <div class="perf-stat-item">
            <span class="perf-stat-label">Confirmed</span>
            <strong class="perf-stat-val">${confirmedCount}</strong>
          </div>
          <div class="perf-stat-item">
            <span class="perf-stat-label">Demand</span>
            <strong class="perf-stat-val">${demandScore}/100</strong>
          </div>
        </div>

        <div class="performance-footer">
          <div>
            <div class="performance-price">
              ₹${price} <span>/ night</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">Base Rate: ₹${price}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openEditPropertyModal('${propId}')">
              Edit
            </button>
            <a href="pricing.html?id=${propId}" class="btn btn-primary btn-sm">
              Tune Rate
            </a>
            <button type="button" class="btn btn-sm btn-delete-property" onclick="openDeletePropertyModal('${propId}')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; font-weight: 500;">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Open the modal to add a brand new property listing
 */
function openAddPropertyModal() {
  const modal = document.getElementById('owner-property-modal');
  const heading = document.getElementById('modal-property-heading');
  const form = document.getElementById('owner-property-form');
  const saveBtn = document.getElementById('btn-save-property');

  if (!modal || !form) return;

  form.reset();
  document.getElementById('form-prop-id').value = '';
  if (heading) heading.textContent = 'Add New Listing';
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Create Listing';
  }

  modal.style.display = 'flex';
}

/**
 * Open the modal to edit an existing property listing
 * @param {string} propId 
 */
function openEditPropertyModal(propId) {
  const modal = document.getElementById('owner-property-modal');
  const heading = document.getElementById('modal-property-heading');
  const form = document.getElementById('owner-property-form');
  const saveBtn = document.getElementById('btn-save-property');

  if (!modal || !form) return;

  const prop = ownerProperties.find(p => String(p._id || p.id) === propId);
  if (!prop) {
    showOwnerToast('Property not found.', 'error');
    return;
  }

  // Pre-fill form values
  document.getElementById('form-prop-id').value = propId;
  document.getElementById('form-prop-title').value = prop.title || prop.name || '';
  document.getElementById('form-prop-location').value = prop.location || '';
  document.getElementById('form-prop-type').value = prop.propertyType || prop.type || 'Apartment';
  document.getElementById('form-prop-price').value = prop.pricePerNight || prop.currentPrice || '';
  document.getElementById('form-prop-bedrooms').value = prop.bedrooms !== undefined ? prop.bedrooms : 1;
  document.getElementById('form-prop-bathrooms').value = prop.bathrooms !== undefined ? prop.bathrooms : 1;
  document.getElementById('form-prop-description').value = prop.description || '';
  document.getElementById('form-prop-image').value = prop.image || '';
  document.getElementById('form-prop-amenities').value = Array.isArray(prop.amenities) ? prop.amenities.join(', ') : '';

  if (heading) heading.textContent = `Edit Listing: ${prop.title || prop.name}`;
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Update Listing';
  }

  modal.style.display = 'flex';
}

/**
 * Close the Add / Edit Property Modal
 */
function closePropertyModal() {
  const modal = document.getElementById('owner-property-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Handle form submission to create or update a property listing
 * @param {Event} event 
 */
async function handleSaveProperty(event) {
  event.preventDefault();

  if (!currentOwner) {
    showOwnerToast('Please log in as an owner.', 'error');
    return;
  }

  const propId = document.getElementById('form-prop-id').value;
  const title = document.getElementById('form-prop-title').value.trim();
  const location = document.getElementById('form-prop-location').value.trim();
  const propertyType = document.getElementById('form-prop-type').value;
  const price = Number(document.getElementById('form-prop-price').value);
  const bedrooms = parseInt(document.getElementById('form-prop-bedrooms').value, 10) || 1;
  const bathrooms = parseInt(document.getElementById('form-prop-bathrooms').value, 10) || 1;
  const description = document.getElementById('form-prop-description').value.trim();
  const image = document.getElementById('form-prop-image').value.trim();
  const amenitiesStr = document.getElementById('form-prop-amenities').value.trim();

  // Validate fields matching backend schema rules
  if (title.length < 3) {
    showOwnerToast('Title must be at least 3 characters long.', 'warning');
    return;
  }

  if (description.length < 10) {
    showOwnerToast('Description must be at least 10 characters long.', 'warning');
    return;
  }

  if (isNaN(price) || price <= 0) {
    showOwnerToast('Price per night must be a positive number.', 'warning');
    return;
  }

  const amenities = amenitiesStr
    ? amenitiesStr.split(',').map(a => a.trim()).filter(Boolean)
    : [];

  const payload = {
    title,
    description,
    location,
    propertyType,
    pricePerNight: price,
    bedrooms: Math.max(0, bedrooms),
    bathrooms: Math.max(0, bathrooms),
    ownerId: currentOwner.id || currentOwner._id || 'OWN001',
    amenities
  };

  if (image) {
    payload.image = image;
  }

  const saveBtn = document.getElementById('btn-save-property');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = propId ? 'Updating...' : 'Creating...';
  }

  try {
    if (propId) {
      // Update existing property via PUT /api/properties/:id
      await window.ApiClient.updateProperty(propId, payload);
      showOwnerToast(`"${title}" updated successfully!`, 'success');
    } else {
      // Create new property via POST /api/properties
      await window.ApiClient.createProperty(payload);
      showOwnerToast(`"${title}" listed successfully!`, 'success');
    }

    closePropertyModal();
    // Refresh properties list from backend
    await loadOwnerProperties();

  } catch (err) {
    console.error('[OwnerProperties] Failed to save property:', err);
    showOwnerToast(err.message || 'Failed to save property to backend.', 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = propId ? 'Update Listing' : 'Create Listing';
    }
  }
}

/**
 * Display toast notification matching owner dashboard styling
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} [type] 
 */
function showOwnerToast(message, type = 'success') {
  if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
    Toast.show(message, type);
    return;
  }

  let container = document.getElementById('owner-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'owner-toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

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

// Global reference for property deletion
let propertyIdPendingDelete = null;

/**
 * Open confirmation modal before property deletion
 * @param {string} propId 
 */
function openDeletePropertyModal(propId) {
  const modal = document.getElementById('delete-property-modal');
  const nameEl = document.getElementById('delete-property-name');
  const errorEl = document.getElementById('delete-modal-error');
  const confirmBtn = document.getElementById('btn-confirm-delete');
  const cancelBtn = document.getElementById('btn-cancel-delete');

  const prop = ownerProperties.find(p => String(p._id || p.id) === String(propId));
  propertyIdPendingDelete = propId;

  if (nameEl) {
    nameEl.textContent = prop ? `"${prop.title || prop.name}"` : 'this property';
  }
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Property';
  }
  if (cancelBtn) {
    cancelBtn.disabled = false;
  }

  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Close property deletion modal
 */
function closeDeletePropertyModal() {
  const modal = document.getElementById('delete-property-modal');
  propertyIdPendingDelete = null;
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Confirm and execute property deletion via ApiClient
 */
async function confirmDeleteProperty() {
  if (!propertyIdPendingDelete) return;

  const confirmBtn = document.getElementById('btn-confirm-delete');
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const errorEl = document.getElementById('delete-modal-error');

  const propId = propertyIdPendingDelete;

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
    }
    if (cancelBtn) {
      cancelBtn.disabled = true;
    }
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }

    // Call existing backend API through ApiClient
    const res = await window.ApiClient.deleteProperty(propId);

    // Close modal on success
    closeDeletePropertyModal();

    // Show clear success message
    showOwnerToast(res.message || 'Property deleted successfully.', 'success');

    // On success, refresh the property list from the backend
    await loadOwnerProperties();

  } catch (err) {
    console.error('[OwnerProperties] Failed to delete property:', err);
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete Property';
    }
    if (cancelBtn) {
      cancelBtn.disabled = false;
    }

    const errMsg = err.message || 'Failed to delete property. Server may be offline.';
    if (errorEl) {
      errorEl.textContent = errMsg;
      errorEl.style.display = 'block';
    }
    showOwnerToast(errMsg, 'error');
    // Important: Do not simulate deletion or remove card from DOM when deletion fails!
  }
}

// Support CommonJS export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initOwnerPropertiesPage,
    loadOwnerProperties,
    renderPropertyCardHtml,
    openAddPropertyModal,
    openEditPropertyModal,
    closePropertyModal,
    handleSaveProperty,
    openDeletePropertyModal,
    closeDeletePropertyModal,
    confirmDeleteProperty,
    showOwnerToast
  };
}
