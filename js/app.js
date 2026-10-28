/**
 * DynamicRent - Global Application Bootstrap (js/app.js)
 * Manages homepage interactive behaviors, demo helpers, and dynamic navigation updates based on active session.
 */

document.addEventListener('DOMContentLoaded', () => {
  initLandingPageNav();
  loadLandingProperties();
  console.log('DynamicRent application initialized.');
});

/**
 * Fetch live featured properties from Express backend (GET /api/properties).
 * When backend is stopped/unavailable, shows a clear error message:
 * “Unable to connect to the server. Please try again.”
 */
async function loadLandingProperties() {
  const gridEl = document.getElementById('featured-properties-grid');
  const errorEl = document.getElementById('landing-backend-error-state');
  if (!gridEl) return;

  // Clear property containers and hide before fetching data
  gridEl.innerHTML = '';
  gridEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  try {
    if (!window.ApiClient || typeof window.ApiClient.getProperties !== 'function') {
      throw new Error('Unable to connect to the server. Please try again.');
    }

    console.log('[Properties Source: Backend API (MongoDB Atlas)] Fetching from:', window.ApiClient.BASE_URL + '/properties');
    const properties = await window.ApiClient.getProperties();
    console.log('[Properties Source: Backend API (MongoDB Atlas)] Successfully received', properties.length, 'properties from MongoDB');

    if (!Array.isArray(properties) || properties.length === 0) {
      if (errorEl) errorEl.style.display = 'none';
      gridEl.style.display = 'block';
      gridEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px; grid-column: 1/-1;">No properties are currently available.</p>';
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    gridEl.style.display = 'grid';

    // Render up to 4 featured properties
    const featured = properties.slice(0, 4);
    gridEl.innerHTML = featured.map(p => renderLandingPropertyCard(p)).join('');

    // Re-adjust card links based on current session
    initLandingPageNav();

  } catch (err) {
    console.log('[Properties Source: None - Backend Offline] Zero properties displayed due to error:', err.message);
    if (gridEl) {
      gridEl.style.display = 'none';
      gridEl.innerHTML = '';
    }
    if (errorEl) {
      errorEl.style.display = 'block';
    }
  }
}

/**
 * Render single property card for homepage
 * @param {Object} p Property document
 * @returns {string} HTML markup
 */
function renderLandingPropertyCard(p) {
  const fallbackImg = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';
  const img = p.image || fallbackImg;
  const title = p.title || p.name || 'Untitled Property';
  const location = p.location || 'Location unavailable';
  const type = p.propertyType || p.type || 'Stay';
  const price = typeof p.pricePerNight === 'number' ? p.pricePerNight : (p.currentPrice || 0);
  const rating = typeof p.rating === 'number' ? p.rating.toFixed(1) : '4.8';
  const bedrooms = p.bedrooms !== undefined ? p.bedrooms : 1;
  const bathrooms = p.bathrooms !== undefined ? p.bathrooms : 1;

  // Destination link based on session
  let viewHref = 'login.html';
  try {
    const raw = sessionStorage.getItem('currentUser');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.role) {
        viewHref = user.role.toLowerCase() === 'customer' 
          ? `customer/property-details.html?id=${p.id || p._id}` 
          : 'owner/properties.html';
      }
    }
  } catch (e) {
    // default to login.html
  }

  return `
    <div class="property-card">
      <div class="property-image-wrapper">
        <img 
          src="${img}" 
          alt="${title}"
          loading="lazy"
          onerror="this.onerror=null;this.src='${fallbackImg}';"
        >
        <span class="badge badge-success property-badge">${type}</span>
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
          ${location}
        </div>
        <h3 class="property-title">${title}</h3>
        <div class="property-features">
          <span>${bedrooms} ${bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</span> • <span>${bathrooms} ${bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</span>
        </div>
        <div class="property-footer">
          <div class="property-price">₹${price.toLocaleString('en-IN')} <span>/ night</span></div>
          <a href="${viewHref}" class="btn btn-secondary btn-sm">View Property</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Dynamically adjust homepage navigation links if a user is already authenticated
 */
function initLandingPageNav() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return;

    const user = JSON.parse(raw);
    if (!user || !user.role) return;

    const isCustomer = user.role.toLowerCase() === 'customer';
    const isOwner = user.role.toLowerCase() === 'owner';

    if (!isCustomer && !isOwner) return;

    // 1. Update Navbar Action Buttons
    const loginBtn = document.getElementById('nav-login-btn');
    const registerBtn = document.getElementById('nav-register-btn');

    if (loginBtn) {
      loginBtn.textContent = isCustomer ? 'Dashboard' : 'Owner Cockpit';
      loginBtn.href = isCustomer ? 'customer/dashboard.html' : 'owner/dashboard.html';
      loginBtn.className = 'btn btn-primary';
    }

    if (registerBtn) {
      registerBtn.textContent = isCustomer ? 'My Bookings' : 'Pricing Cockpit';
      registerBtn.href = isCustomer ? 'customer/my-bookings.html' : 'owner/pricing.html';
      registerBtn.className = 'btn btn-secondary';
    }

    // 2. Update Nav Links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.getAttribute('href') === 'login.html') {
        link.href = isCustomer ? 'customer/properties.html' : 'owner/properties.html';
      }
    });

    // 3. Update Hero Explore Button
    const heroExploreBtn = document.getElementById('hero-explore-btn');
    if (heroExploreBtn) {
      heroExploreBtn.href = isCustomer ? 'customer/properties.html' : 'owner/properties.html';
    }

    // 4. Update Featured Property Cards View Buttons
    const featuredLinks = document.querySelectorAll('.property-footer a[href="login.html"], .footer-links a[href="login.html"]');
    featuredLinks.forEach(link => {
      const text = link.textContent.trim().toLowerCase();
      if (text.includes('view') || text.includes('explore') || text.includes('propert')) {
        link.href = isCustomer ? 'customer/properties.html' : 'owner/properties.html';
      }
    });

  } catch (err) {
    console.warn('Could not read currentUser session on landing page:', err);
  }
}

