/**
 * DynamicRent - Customer Module: Property Details (js/customer/propertyDetails.js)
 * Reads property ID from URL query parameters, queries dataset,
 * renders detailed property specifications, handles amenities, and error states.
 */

document.addEventListener('DOMContentLoaded', () => {
  initPropertyDetails();
});

/**
 * Initialize and load property details based on URL query parameter
 */
function initPropertyDetails() {
  try {
    // 1. Ensure property dataset is initialized in storage
    if (typeof initDefaultProperties === 'function') {
      initDefaultProperties();
    }

    // 2. Extract 'id' query parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');

    if (!propertyId) {
      console.warn('No property ID supplied in URL query string.');
      showPropertyNotFound();
      return;
    }

    // 3. Query property by ID from Storage
    const property = StorageUtils.getPropertyById(propertyId);

    if (!property) {
      console.warn(`Property with ID "${propertyId}" was not found.`);
      showPropertyNotFound();
      return;
    }

    // 4. Render property information
    renderPropertyDetails(property);
  } catch (err) {
    console.error('Error loading property details:', err);
    showPropertyNotFound();
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

  // Page title / Header
  const headerTitleEl = document.getElementById('page-header-title');
  if (headerTitleEl) headerTitleEl.textContent = property.name;
  document.title = `${property.name} | DynamicRent`;

  // Hero Image
  const imgEl = document.getElementById('details-image');
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  if (imgEl) {
    imgEl.src = property.image || fallbackImg;
    imgEl.alt = property.name;
    imgEl.onerror = function() {
      this.onerror = null;
      this.src = fallbackImg;
    };
  }

  // Name & Rating
  const titleEl = document.getElementById('details-title');
  if (titleEl) titleEl.textContent = property.name;

  const ratingEl = document.getElementById('details-rating');
  if (ratingEl) ratingEl.textContent = property.rating ? property.rating.toFixed(1) : '4.8';

  const reviewsEl = document.getElementById('details-reviews');
  if (reviewsEl) reviewsEl.textContent = `(${property.reviews || 0} reviews)`;

  // Location
  const locationEl = document.getElementById('details-location');
  if (locationEl) {
    const locText = property.area 
      ? `${property.area}, ${property.location}, India` 
      : `${property.location}, India`;
    locationEl.textContent = locText;
  }

  // Specs
  const typeEl = document.getElementById('details-type');
  if (typeEl) typeEl.textContent = property.type || 'Residence';

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
  if (amenitiesContainer && Array.isArray(property.amenities)) {
    amenitiesContainer.innerHTML = property.amenities.map(amenity => {
      const icon = getAmenityIcon(amenity);
      return `<div class="amenity-item"><span>${icon}</span> <span>${amenity}</span></div>`;
    }).join('');
  }

  // Price & Status
  const priceEl = document.getElementById('details-price');
  const priceVal = property.currentPrice || property.pricePerNight || 0;
  if (priceEl) priceEl.textContent = `₹${priceVal.toLocaleString('en-IN')}`;

  const statusEl = document.getElementById('details-status');
  if (statusEl) {
    const isAvail = property.status === 'available';
    statusEl.textContent = isAvail ? 'Available' : 'Unavailable';
    statusEl.className = isAvail ? 'badge badge-success' : 'badge badge-warning';
  }

  // Book Now Button
  const bookBtn = document.getElementById('details-book-btn');
  if (bookBtn) {
    if (property.status === 'available') {
      bookBtn.href = `booking.html?id=${property.id}`;
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
 * Display the "Property not found" error state
 */
function showPropertyNotFound() {
  const contentContainer = document.getElementById('property-details-content');
  const notFoundContainer = document.getElementById('property-not-found');

  if (contentContainer) contentContainer.style.display = 'none';
  if (notFoundContainer) notFoundContainer.style.display = 'block';

  const headerTitleEl = document.getElementById('page-header-title');
  if (headerTitleEl) headerTitleEl.textContent = 'Property Not Found';
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
