/**
 * DynamicRent - Authentication Guard (js/auth/authGuard.js)
 * Provides reusable client-side route protection, role verification,
 * session integrity checking, and dynamic user greeting injection.
 */

/**
 * Safely retrieve the current authenticated user from sessionStorage.
 * If session data is missing or corrupted, it sanitizes storage and returns null.
 * @returns {Object|null}
 */
function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object' || !user.role || !user.email) {
      sessionStorage.removeItem('currentUser');
      return null;
    }
    return user;
  } catch (err) {
    console.error('Corrupted session data detected. Purging session:', err);
    sessionStorage.removeItem('currentUser');
    return null;
  }
}

/**
 * Central route protection guard.
 * Validates whether the user is logged in and possesses the required role.
 * Redirects immediately if unauthenticated or wrong role.
 * @param {string} [requiredRole] 'customer' | 'owner' | null
 * @returns {Object|null} Authenticated user object if valid
 */
function requireLogin(requiredRole) {
  const user = getCurrentUser();

  // Case 1: User is not logged in
  if (!user) {
    redirectToLogin();
    return null;
  }

  // Case 2: User is logged in, but role is restricted
  if (requiredRole && user.role.toLowerCase() !== requiredRole.toLowerCase()) {
    if (user.role.toLowerCase() === 'customer') {
      redirectToCustomerDashboard();
    } else if (user.role.toLowerCase() === 'owner') {
      redirectToOwnerDashboard();
    } else {
      redirectToLogin();
    }
    return null;
  }

  // Case 3: Valid authenticated session - inject user information into DOM when loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updateUserDisplay(user));
  } else {
    updateUserDisplay(user);
  }

  return user;
}

/**
 * Guard strictly requiring a logged-in Customer.
 * Protects customer/*.html pages.
 * @returns {Object|null}
 */
function requireCustomer() {
  return requireLogin('customer');
}

/**
 * Guard strictly requiring a logged-in Owner.
 * Protects owner/*.html pages.
 * @returns {Object|null}
 */
function requireOwner() {
  return requireLogin('owner');
}

/**
 * Redirect unauthenticated users to login page
 */
function redirectToLogin() {
  const isInsideFolder = window.location.pathname.includes('/customer/') || window.location.pathname.includes('/owner/');
  const target = isInsideFolder ? '../login.html' : 'login.html';
  window.location.href = target;
}

/**
 * Redirect customer to their dashboard
 */
function redirectToCustomerDashboard() {
  const isInsideFolder = window.location.pathname.includes('/customer/') || window.location.pathname.includes('/owner/');
  const target = isInsideFolder ? '../customer/dashboard.html' : 'customer/dashboard.html';
  window.location.href = target;
}

/**
 * Redirect owner to their dashboard
 */
function redirectToOwnerDashboard() {
  const isInsideFolder = window.location.pathname.includes('/customer/') || window.location.pathname.includes('/owner/');
  const target = isInsideFolder ? '../owner/dashboard.html' : 'owner/dashboard.html';
  window.location.href = target;
}

/**
 * Update DOM elements with dynamic user name and role badge
 * @param {Object} user 
 */
function updateUserDisplay(user) {
  if (!user) return;

  // 1. Update header subtitle / welcome greeting
  const greetingEl = document.getElementById('user-greeting-name');
  if (greetingEl) {
    greetingEl.textContent = `Welcome back, ${user.name}`;
  }

  const nameDisplays = document.querySelectorAll('.user-name-display');
  nameDisplays.forEach(el => {
    el.textContent = user.name;
  });

  // 2. Update navbar user pill
  const userBadge = document.getElementById('nav-user-badge');
  if (userBadge) {
    userBadge.textContent = `${user.name} (${user.role.toUpperCase()})`;
  }
}
