/**
 * DynamicRent - Customer Module: Property Details (js/customer/propertyDetails.js)
 * Reads property ID from URL query parameters, queries dataset,
 * renders detailed property specifications, handles amenities, and error states.
 */

document.addEventListener('DOMContentLoaded', () => {
  initPropertyDetails();
});

/**
 * Initialize and load property details based on URL query parameter via Express backend
 */
async function initPropertyDetails() {
  const contentContainer = document.getElementById('property-details-content');
  const notFoundContainer = document.getElementById('property-not-found');
  const loadingContainer = document.getElementById('property-details-loading');

  // 1. Extract 'id' query parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get('id');

  if (!propertyId) {
    console.warn('No property ID supplied in URL query string.');
    showPropertyError('Please select a property from the catalog.', 'No Property Selected');
    return;
  }

  // 2. Show loading indicator and hide previous content
  if (loadingContainer) loadingContainer.style.display = 'block';
  if (contentContainer) contentContainer.style.display = 'none';
  if (notFoundContainer) notFoundContainer.style.display = 'none';

  try {
    if (!window.ApiClient || typeof window.ApiClient.getPropertyById !== 'function') {
      throw new Error('ApiClient module is not loaded. Please ensure js/utils/api.js is included.');
    }

    // 3. Query property by ID from MongoDB Atlas via Express API
    console.log(`[PropertyDetails Source: Requesting property ${propertyId} from backend API...]`);
    const property = await window.ApiClient.getPropertyById(propertyId);
    console.log('[PropertyDetails Source: Backend API returned property]', property);

    if (loadingContainer) loadingContainer.style.display = 'none';

    // 4. Render property information
    renderPropertyDetails(property);
  } catch (err) {
    console.error('[PropertyDetails Source: None - Backend Offline/Error]', err);
    if (loadingContainer) loadingContainer.style.display = 'none';
    const is404 = err.status === 404;
    showPropertyError(
      is404 ? (err.message || 'The requested property could not be located.') : 'Unable to connect to the server. Please try again.',
      is404 ? 'Property Not Found' : 'Unable to connect to the server. Please try again.'
    );
  }
}

/**
 * Populate all DOM elements on the property details page
 * @param {Object} property 
 */
function renderPropertyDetails(property) {
  const contentContainer = document.getElementById('property-details-content');
  const notFoundContainer = document.getElementById('property-not-found');

  if (notFoundContainer) notFoundContainer.style.display = 'none';
  if (contentContainer) contentContainer.style.display = 'grid';

  const propId = property.id || property._id;
  const propName = property.name || property.title || 'Property Details';
  const propType = property.type || property.propertyType || 'Residence';
  const priceVal = property.pricePerNight !== undefined ? property.pricePerNight : (property.currentPrice || 0);
  const isAvail = property.status ? property.status === 'available' : true;

  // Page title / Header
  const headerTitleEl = document.getElementById('page-header-title');
  if (headerTitleEl) headerTitleEl.textContent = propName;
  document.title = `${propName} | DynamicRent`;

  // Hero Image
  const imgEl = document.getElementById('details-image');
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  if (imgEl) {
    imgEl.src = property.image || fallbackImg;
    imgEl.alt = propName;
    imgEl.onerror = function() {
      this.onerror = null;
      this.src = fallbackImg;
    };
  }

  // Name & Rating
  const titleEl = document.getElementById('details-title');
  if (titleEl) titleEl.textContent = propName;

  const ratingEl = document.getElementById('details-rating');
  if (ratingEl) ratingEl.textContent = property.rating ? property.rating.toFixed(1) : '4.8';

  const reviewsEl = document.getElementById('details-reviews');
  if (reviewsEl) reviewsEl.textContent = `(${property.reviews || 0} reviews)`;

  // Location
  const locationEl = document.getElementById('details-location');
  if (locationEl) {
    const locText = property.area 
      ? `${property.area}, ${property.location}, India` 
      : `${property.location || 'India'}`;
    locationEl.textContent = locText;
  }

  // Specs
  const typeEl = document.getElementById('details-type');
  if (typeEl) typeEl.textContent = propType;

  const guestsEl = document.getElementById('details-guests');
  if (guestsEl) guestsEl.textContent = `${property.guests || 2} Guests`;

  const bedEl = document.getElementById('details-bedrooms');
  if (bedEl) bedEl.textContent = `${property.bedrooms || 1} Bedrooms`;

  const bathEl = document.getElementById('details-bathrooms');
  if (bathEl) bathEl.textContent = `${property.bathrooms || 1} Bathrooms`;

  // Description
  const descEl = document.getElementById('details-description');
  if (descEl) descEl.textContent = property.description || 'Experience a comfortable and relaxing stay at this verified rental.';

  // Amenities
  const amenitiesContainer = document.getElementById('details-amenities');
  if (amenitiesContainer) {
    const amenitiesList = Array.isArray(property.amenities) && property.amenities.length > 0
      ? property.amenities
      : ['WiFi', 'Air Conditioning', 'Power Backup', 'Parking'];
    amenitiesContainer.innerHTML = amenitiesList.map(amenity => {
      const icon = getAmenityIcon(amenity);
      return `<div class="amenity-item"><span>${icon}</span> <span>${amenity}</span></div>`;
    }).join('');
  }

  // Price & Status
  const priceEl = document.getElementById('details-price');
  if (priceEl) priceEl.textContent = `₹${priceVal.toLocaleString('en-IN')}`;

  const statusEl = document.getElementById('details-status');
  if (statusEl) {
    statusEl.textContent = isAvail ? 'Available' : 'Unavailable';
    statusEl.className = isAvail ? 'badge badge-success' : 'badge badge-warning';
  }

  // Book Now Button
  const bookBtn = document.getElementById('details-book-btn');
  if (bookBtn) {
    if (isAvail) {
      bookBtn.href = `booking.html?id=${propId}`;
      bookBtn.innerHTML = `
        <span>Book Now</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
      bookBtn.classList.remove('btn-secondary', 'disabled');
      bookBtn.classList.add('btn-primary');
      bookBtn.removeAttribute('aria-disabled');
      bookBtn.style.opacity = '1';
      bookBtn.style.cursor = 'pointer';
    } else {
      bookBtn.href = 'javascript:void(0)';
      bookBtn.innerHTML = `<span>Currently Unavailable</span>`;
      bookBtn.classList.remove('btn-primary');
      bookBtn.classList.add('btn-secondary');
      bookBtn.setAttribute('aria-disabled', 'true');
      bookBtn.style.opacity = '0.65';
      bookBtn.style.cursor = 'not-allowed';
    }
  }
}

/**
 * Display property error state (not found or connection failure)
 * @param {string} [message]
 * @param {string} [title]
 */
function showPropertyError(message, title = 'Property Not Found') {
  const contentContainer = document.getElementById('property-details-content');
  const notFoundContainer = document.getElementById('property-not-found');

  if (contentContainer) contentContainer.style.display = 'none';
  if (notFoundContainer) notFoundContainer.style.display = 'block';

  const headerTitleEl = document.getElementById('page-header-title');
  if (headerTitleEl) headerTitleEl.textContent = title;

  const errorTitleEl = document.getElementById('error-state-title');
  if (errorTitleEl) errorTitleEl.textContent = title;

  const errorMsgEl = document.getElementById('error-state-message');
  if (errorMsgEl && message) errorMsgEl.textContent = message;
}

/**
 * Display the "Property not found" error state
 */
function showPropertyNotFound() {
  showPropertyError('The requested property could not be located or may have been removed.', 'Property Not Found');
}

/**
 * Helper to select an emoji/icon matching the amenity name
 * @param {string} amenity 
 * @returns {string} Emoji string
 */
function getAmenityIcon(amenity) {
  const a = amenity.toLowerCase();
  if (a.includes('wifi')) return '📶';
  if (a.includes('pool')) return '🏊';
  if (a.includes('park')) return '🚗';
  if (a.includes('air') || a.includes('ac')) return '❄️';
  if (a.includes('kitchen')) return '🍳';
  if (a.includes('garden') || a.includes('lawn')) return '🌿';
  if (a.includes('view') || a.includes('lake') || a.includes('beach')) return '🌅';
  if (a.includes('gym')) return '💪';
  if (a.includes('elevator')) return '🛗';
  if (a.includes('tv')) return '📺';
  if (a.includes('security') || a.includes('guard')) return '🔒';
  if (a.includes('power') || a.includes('backup')) return '⚡';
  if (a.includes('pet')) return '🐾';
  return '✓';
}
