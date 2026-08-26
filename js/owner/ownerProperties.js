/**
 * DynamicRent - Owner Module: Properties (js/owner/ownerProperties.js)
 * Displays the owner's portfolio listings with live occupancy rates, demand scoring, and pricing info.
 */

document.addEventListener('DOMContentLoaded', () => {
  initOwnerPropertiesPage();
});

/**
 * Initialize Owner Properties Page
 */
function initOwnerPropertiesPage() {
  try {
    if (typeof initDefaultProperties === 'function') initDefaultProperties();
    if (typeof initDefaultUsers === 'function') initDefaultUsers();

    const currentOwner = StorageUtils.getCurrentUser();
    if (!currentOwner || currentOwner.role !== 'owner') {
      redirectToLogin();
      return;
    }

    // Update Header
    const nameEl = document.getElementById('owner-name-display');
    if (nameEl) nameEl.textContent = currentOwner.name || 'Owner';

    const avatarEl = document.getElementById('owner-avatar');
    if (avatarEl && currentOwner.name) {
      const initials = currentOwner.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || 'O';
    }

    // Load Properties
    const ownerProperties = StorageUtils.getOwnerProperties(currentOwner.id);
    const grid = document.getElementById('owner-properties-grid');
    if (!grid) return;

    if (!ownerProperties || ownerProperties.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>No properties registered.</h3>
          <p>No listings are currently attached to your owner account.</p>
        </div>
      `;
      return;
    }

    const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
      ? PROPERTY_IMAGE_FALLBACK 
      : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

    grid.innerHTML = ownerProperties.map(prop => {
      const occStats = typeof OccupancyEngine !== 'undefined' 
        ? OccupancyEngine.calculatePropertyOccupancy(prop.id) 
        : { occupancyRate: 0, confirmedBookingsCount: 0 };

      const demandStats = typeof DemandEngine !== 'undefined' 
        ? DemandEngine.calculateDemandScore(prop.id) 
        : { score: 30, level: 'Low' };

      const demandBadgeHtml = typeof DemandEngine !== 'undefined' 
        ? DemandEngine.getDemandBadgeHtml(demandStats.level, demandStats.score) 
        : `<span class="demand-badge demand-low">Low (${demandStats.score}/100)</span>`;

      const price = (prop.currentPrice || prop.pricePerNight || 0).toLocaleString('en-IN');
      const basePrice = (prop.pricePerNight || prop.basePrice || prop.currentPrice || 0).toLocaleString('en-IN');
      const locationStr = prop.area ? `${prop.area}, ${prop.location}` : prop.location;

      return `
        <div class="performance-card">
          <div class="performance-media">
            <img 
              src="${prop.image || fallbackImg}" 
              alt="${prop.name}"
              onerror="this.onerror=null;this.src='${fallbackImg}';"
            >
            <span class="badge badge-primary performance-badge-left">${prop.type || 'Stay'}</span>
            <div class="performance-badge-right">
              ${demandBadgeHtml}
            </div>
          </div>

          <div class="performance-body">
            <div>
              <h3 class="performance-title">${prop.name}</h3>
              <div class="performance-location">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${locationStr}, India</span>
              </div>
            </div>

            <div class="performance-stats-strip">
              <div class="perf-stat-item">
                <span class="perf-stat-label">Occupancy</span>
                <strong class="perf-stat-val" style="color: var(--owner-primary-dark);">${occStats.occupancyRate}%</strong>
              </div>
              <div class="perf-stat-item">
                <span class="perf-stat-label">Confirmed</span>
                <strong class="perf-stat-val">${occStats.confirmedBookingsCount}</strong>
              </div>
              <div class="perf-stat-item">
                <span class="perf-stat-label">Demand</span>
                <strong class="perf-stat-val">${demandStats.score}/100</strong>
              </div>
            </div>

            <div class="performance-footer">
              <div>
                <div class="performance-price">
                  ₹${price} <span>/ night</span>
                </div>
                <div style="font-size: 0.76rem; color: var(--owner-text-muted);">Base: ₹${basePrice}</div>
              </div>
              <a href="pricing.html?id=${prop.id}" class="btn btn-primary btn-sm">Tune Rate</a>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error rendering owner properties:', err);
  }
}
