/**
 * DynamicRent - Authentication Module: Login
 * Handles credential verification, role matching, demo user initialization,
 * sessionStorage management (currentUser), role-based redirection, and password visibility toggle.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure default demo accounts exist in localStorage
  if (typeof initDefaultUsers === 'function') {
    initDefaultUsers();
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Setup password show/hide eye toggle
  setupPasswordToggles();

  // Setup demo account quick-fill buttons
  setupDemoQuickFill();
});

/**
 * Handle login form submission
 * @param {Event} event 
 */
function handleLogin(event) {
  event.preventDefault();

  // Clear previous alert messages
  hideAlertBanner();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const roleInput = document.querySelector('input[name="role"]:checked');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const role = roleInput ? roleInput.value : '';

  // Basic client-side check
  if (!email || !password || !role) {
    showAlertBanner('Please enter your email, password, and select your role.', 'danger');
    return;
  }

  // Retrieve registered users from localStorage
  const users = getRegisteredUsers();

  // Find matching user with email, password, and role
  const matchedUser = users.find(u => 
    u.email.toLowerCase() === email.toLowerCase() &&
    u.password === password &&
    u.role.toLowerCase() === role.toLowerCase()
  );

  if (!matchedUser) {
    // Show generic error message without revealing which specific field was wrong
    showAlertBanner('Invalid email, password or role.', 'danger');
    if (passwordInput) passwordInput.value = '';
    return;
  }

  // Credentials are valid: Store logged-in user in sessionStorage under 'currentUser'
  const sessionUser = {
    id: matchedUser.id,
    name: matchedUser.name,
    email: matchedUser.email,
    role: matchedUser.role
  };

  try {
    sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));
  } catch (err) {
    console.error('Failed to save currentUser to sessionStorage:', err);
  }

  // Show success alert & disable submit button
  showAlertBanner('Login successful! Redirecting...', 'success');

  const submitBtn = document.getElementById('login-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span>Redirecting...</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"></path>
        <path d="M12 5l7 7-7 7"></path>
      </svg>
    `;
  }

  // Role-based redirection after short transition
  setTimeout(() => {
    if (sessionUser.role === 'customer') {
      window.location.href = 'customer/dashboard.html';
    } else if (sessionUser.role === 'owner') {
      window.location.href = 'owner/dashboard.html';
    } else {
      window.location.href = 'index.html';
    }
  }, 800);
}

/**
 * Retrieve registered users from localStorage
 * @returns {Array}
 */
function getRegisteredUsers() {
  try {
    const data = localStorage.getItem('dynamicRentUsers');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading dynamicRentUsers:', e);
    return [];
  }
}

/**
 * Display alert banner at top of form
 * @param {string} message 
 * @param {string} type 'danger' | 'success'
 */
function showAlertBanner(message, type = 'danger') {
  const banner = document.getElementById('auth-alert-banner');
  if (banner) {
    banner.className = `alert-banner alert-${type}`;
    banner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'success' 
          ? '<polyline points="20 6 9 17 4 12"></polyline>' 
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
      <span>${message}</span>
    `;
    banner.style.display = 'flex';
  }
}

/**
 * Hide alert banner
 */
function hideAlertBanner() {
  const banner = document.getElementById('auth-alert-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Setup Show/Hide password toggle buttons
 */
function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-password-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        // Update toggle icon (eye vs eye-off)
        btn.innerHTML = isPassword ? `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ` : `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      }
    });
  });
}

/**
 * Setup quick-fill helper buttons for demo accounts
 */
function setupDemoQuickFill() {
  const demoButtons = document.querySelectorAll('.demo-quick-btn');
  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const role = btn.getAttribute('data-role');
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');
      const roleRadio = document.querySelector(`input[name="role"][value="${role}"]`);

      if (emailInput) emailInput.value = email;
      if (passwordInput) passwordInput.value = '123456';
      if (roleRadio) roleRadio.checked = true;

      hideAlertBanner();
    });
  });
}
