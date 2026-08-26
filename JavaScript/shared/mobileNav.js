/**
 * DynamicRent - Shared Mobile Navigation Handler (js/shared/mobileNav.js)
 * Step 10: Smooth mobile drawer navigation for Owner & Customer portals.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
});

function initMobileNavigation() {
  // 1. Owner Sidebar Mobile Toggle
  const sidebar = document.querySelector('.owner-sidebar');
  const headerLeft = document.querySelector('.owner-header-left');

  if (sidebar && headerLeft && !document.querySelector('.owner-menu-toggle-btn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'owner-menu-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
    toggleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;

    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.gap = '12px';
    headerLeft.insertBefore(toggleBtn, headerLeft.firstChild);

    // Toggle click
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleOwnerSidebar();
    });

    // Close when clicking outside or clicking any nav link
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeOwnerSidebar();
      }
    });

    const navLinks = sidebar.querySelectorAll('.owner-sidebar-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => closeOwnerSidebar());
    });
  }

  // 2. Customer Hamburger Mobile Toggle
  const customerNav = document.querySelector('.nav-links');
  const navContainer = document.querySelector('.nav-container');

  if (customerNav && navContainer && !document.querySelector('.customer-menu-toggle-btn')) {
    const custToggleBtn = document.createElement('button');
    custToggleBtn.type = 'button';
    custToggleBtn.className = 'customer-menu-toggle-btn';
    custToggleBtn.setAttribute('aria-label', 'Toggle Menu');
    custToggleBtn.style.cssText = 'display:none; background:none; border:1px solid var(--border); padding:6px 10px; border-radius:var(--radius-md); cursor:pointer; color:var(--text-primary);';
    custToggleBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;

    navContainer.appendChild(custToggleBtn);

    // Responsive toggle check
    custToggleBtn.addEventListener('click', () => {
      const isHidden = window.getComputedStyle(customerNav).display === 'none';
      if (isHidden) {
        customerNav.style.display = 'flex';
        customerNav.style.flexDirection = 'column';
        customerNav.style.position = 'absolute';
        customerNav.style.top = '100%';
        customerNav.style.left = '0';
        customerNav.style.right = '0';
        customerNav.style.background = '#ffffff';
        customerNav.style.padding = '16px 24px';
        customerNav.style.boxShadow = 'var(--shadow-md)';
        customerNav.style.zIndex = '100';
      } else {
        customerNav.style.display = 'none';
      }
    });
  }
}

function toggleOwnerSidebar() {
  const sidebar = document.querySelector('.owner-sidebar');
  if (!sidebar) return;

  if (sidebar.classList.contains('mobile-open')) {
    closeOwnerSidebar();
  } else {
    sidebar.classList.add('mobile-open');
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.onclick = closeOwnerSidebar;
      document.body.appendChild(backdrop);
    }
  }
}

function closeOwnerSidebar() {
  const sidebar = document.querySelector('.owner-sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop && backdrop.parentNode) {
    backdrop.parentNode.removeChild(backdrop);
  }
}
