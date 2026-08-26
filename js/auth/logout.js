/**
 * DynamicRent - Authentication Module: Logout (js/auth/logout.js)
 * Clears active session state from sessionStorage and safely redirects to login page.
 */

/**
 * Terminate user session and redirect to login page
 */
function logout() {
  console.log('Logging out user. Terminating active session...');
  
  // 1. Remove currentUser from sessionStorage
  try {
    sessionStorage.removeItem('currentUser');
  } catch (err) {
    console.error('Error removing session user:', err);
  }

  // 2. Determine relative path to login.html
  const isInsideFolder = window.location.pathname.includes('/customer/') || window.location.pathname.includes('/owner/');
  const loginPath = isInsideFolder ? '../login.html' : 'login.html';

  // 3. Redirect to login
  window.location.href = loginPath;
}

// Auto-bind click listener to logout buttons when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const logoutButtons = document.querySelectorAll('.btn-logout, [data-action="logout"], #cust-logout-btn, #owner-logout-btn');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  });
});
