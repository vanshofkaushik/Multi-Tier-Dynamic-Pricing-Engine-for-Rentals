/**
 * DynamicRent - Customer Module: Properties Catalog (js/customer/properties.js)
 * Manages property rendering, multi-field search, multi-criteria filtering,
 * dynamic sorting, empty states, and view details navigation.
 */

// Cached all properties in memory for fast client-side filtering
let allProperties = [];

document.addEventListener('DOMContentLoaded', () => {
  initPropertiesPage();
});

/**
 * Initialize properties page state and event listeners
 */
function initPropertiesPage() {
  try {
    // 1. Ensure property dataset is initialized in storage
    if (typeof initDefaultProperties === 'function') {
      initDefaultProperties();
    }

    // 2. Fetch properties from storage
    allProperties = StorageUtils.getProperties();

    // 3. Attach filter & search listeners
    bindEventListeners();

    // 4. Initial render
    applyFiltersAndSort();
  } catch (err) {
    console.error('Error initializing properties page:', err);
  }
}

/**
 * Bind input and change events to search and filter controls
 */
function bindEventListeners() {
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');
  const locationFilter = document.getElementById('location-filter');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  const ratingFilter = document.getElementById('rating-filter');
  const sortSelect = document.getElementById('sort-select');
  const resetBtn = document.getElementById('reset-filters-btn');

  if (searchInput) {
    searchInput.addEventListener('input', () => applyFiltersAndSort());
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', () => applyFiltersAndSort());
  }

  if (locationFilter) {
    locationFilter.addEventListener('change', () => applyFiltersAndSort());
  }

  if (minPriceInput) {
    minPriceInput.addEventListener('input', () => applyFiltersAndSort());
  }

  if (maxPriceInput) {
    maxPriceInput.addEventListener('input', () => applyFiltersAndSort());
  }

  if (ratingFilter) {
    ratingFilter.addEventListener('change', () => applyFiltersAndSort());
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => applyFiltersAndSort());
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetAllFilters();
    });
  }
}

/**
 * Apply search, filters, and sort simultaneously
 */
function applyFiltersAndSort() {
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');
  const locationFilter = document.getElementById('location-filter');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  const ratingFilter = document.getElementById('rating-filter');
  const sortSelect = document.getElementById('sort-select');

  const searchTerm = searchInput ? searchInput.value.trim() : '';
  const selectedType = typeFilter ? typeFilter.value : 'all';
  const selectedLocation = locationFilter ? locationFilter.value : 'all';
  const minPrice = minPriceInput && minPriceInput.value !== '' ? parseFloat(minPriceInput.value) : null;
  const maxPrice = maxPriceInput && maxPriceInput.value !== '' ? parseFloat(maxPriceInput.value) : null;
  const minRating = ratingFilter && ratingFilter.value !== 'all' ? parseFloat(ratingFilter.value) : null;
  const sortType = sortSelect ? sortSelect.value : 'recommended';

  // 1. Filter
  let filtered = allProperties.filter(property => {
    // Search match (Name, Location, Area, or Type)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const nameMatch = property.name && property.name.toLowerCase().includes(q);
      const locMatch = property.location && property.location.toLowerCase().includes(q);
      const areaMatch = property.area && property.area.toLowerCase().includes(q);
      const typeMatch = property.type && property.type.toLowerCase().includes(q);
      if (!nameMatch && !locMatch && !areaMatch && !typeMatch) {
        return false;
      }
    }

    // Property Type
    if (selectedType !== 'all' && property.type.toLowerCase() !== selectedType.toLowerCase()) {
      return false;
    }

    // Location
    if (selectedLocation !== 'all' && property.location.toLowerCase() !== selectedLocation.toLowerCase()) {
      return false;
    }

    // Price Per Night
    const price = property.currentPrice || property.pricePerNight || 0;
    if (minPrice !== null && price < minPrice) {
      return false;
    }
    if (maxPrice !== null && price > maxPrice) {
      return false;
    }

    // Rating
    if (minRating !== null && property.rating < minRating) {
      return false;
    }

    return true;
  });

  // 2. Sort (pure copy, without mutating original dataset)
  filtered = sortPropertyList(filtered, sortType);

  // 3. Render results
  renderProperties(filtered);
}

/**
 * Sort a property array by specified criteria
 * @param {Array} list 
 * @param {string} sortType 
 * @returns {Array} Sorted copy
 */
function sortPropertyList(list, sortType) {
  const copy = [...list];
  switch (sortType) {
    case 'price-asc':
      return copy.sort((a, b) => (a.currentPrice || a.pricePerNight) - (b.currentPrice || b.pricePerNight));
    case 'price-desc':
      return copy.sort((a, b) => (b.currentPrice || b.pricePerNight) - (a.currentPrice || a.pricePerNight));
    case 'rating-desc':
      return copy.sort((a, b) => b.rating - a.rating);
    case 'recommended':
    default:
      return copy;
  }
}

/**
 * Render property card HTML elements into the DOM
 * @param {Array} properties 
 */
function renderProperties(properties) {
  const container = document.getElementById('properties-container');
  const emptyState = document.getElementById('empty-state');
  const resultsCountText = document.getElementById('results-count-text');

  if (!container) return;

  // Update counter text
  if (resultsCountText) {
    const total = allProperties.length;
    resultsCountText.textContent = `Showing ${properties.length} of ${total} available properties`;
  }

  // Handle empty state
  if (properties.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  // Hide empty state and show grid
  if (emptyState) emptyState.style.display = 'none';
  container.style.display = 'grid';

  // Generate cards
  container.innerHTML = properties.map(property => createPropertyCardHtml(property)).join('');
}

/**
 * Generate HTML string for a single property card
 * @param {Object} property 
 * @returns {string} HTML markup
 */
function createPropertyCardHtml(property) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
  
  const price = (property.currentPrice || property.pricePerNight || 0).toLocaleString('en-IN');
  const locationLabel = property.area ? `${property.area}, ${property.location}` : property.location;
  const rating = property.rating ? property.rating.toFixed(1) : '4.8';
  const reviewsCount = property.reviews || 48;
  const guests = property.guests || 2;
  const bedrooms = property.bedrooms || 1;

  // Determine badge styling based on type/rating
  let badgeHtml = '';
  if (property.rating >= 4.8) {
    badgeHtml = `<span class="badge badge-success property-badge">Top Rated</span>`;
  } else if (property.type === 'Villa') {
    badgeHtml = `<span class="badge badge-primary property-badge">Luxury Stay</span>`;
  } else {
    badgeHtml = `<span class="badge badge-info property-badge">${property.type}</span>`;
  }

  return `
    <div class="property-card" id="card-${property.id}">
      <div class="property-image-wrapper">
        <img 
          src="${property.image || fallbackImg}" 
          alt="${property.name}"
          loading="lazy"
          onerror="this.onerror=null; this.src='${fallbackImg}';"
        >
        ${badgeHtml}
        <div class="property-rating">
          <span>★</span> ${rating}
        </div>
      </div>
      
      <div class="property-content">
        <div class="property-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${locationLabel}
        </div>
        
        <h3 class="property-title">${property.name}</h3>
        
        <div class="property-features">
          <span>${property.type}</span> • 
          <span>${guests} Guests</span> • 
          <span>${bedrooms} Bed</span> • 
          <span>(${reviewsCount} reviews)</span>
        </div>
        
        <div class="property-footer">
          <div>
            <div class="property-price">₹${price} <span>/ night</span></div>
            <span style="font-size: 0.76rem; color: var(--primary-green-dark); font-weight: 600;">✓ Available</span>
          </div>
          <a href="property-details.html?id=${property.id}" class="btn btn-secondary btn-sm" id="btn-view-${property.id}">
            View Details
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Reset all filter and search controls back to initial defaults
 */
function resetAllFilters() {
  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');
  const locationFilter = document.getElementById('location-filter');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  const ratingFilter = document.getElementById('rating-filter');
  const sortSelect = document.getElementById('sort-select');

  if (searchInput) searchInput.value = '';
  if (typeFilter) typeFilter.value = 'all';
  if (locationFilter) locationFilter.value = 'all';
  if (minPriceInput) minPriceInput.value = '';
  if (maxPriceInput) maxPriceInput.value = '';
  if (ratingFilter) ratingFilter.value = 'all';
  if (sortSelect) sortSelect.value = 'recommended';

  applyFiltersAndSort();
}
