/**
 * DynamicRent - Authentication Module: Register
 * Handles user input validation, duplicate email prevention, unique ID generation,
 * localStorage persistence (dynamicRentUsers), and password visibility toggling.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure default demo accounts exist
  if (typeof initDefaultUsers === 'function') {
    initDefaultUsers();
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Setup password toggle buttons
  setupPasswordToggles();
});

/**
 * Handle new user registration
 * @param {Event} event 
 */
function handleRegister(event) {
  event.preventDefault();

  // Clear previous errors & status
  clearAllErrors();
  hideAlertBanner();

  // Get field inputs
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const confirmPasswordInput = document.getElementById('reg-confirm-password');
  const roleInput = document.querySelector('input[name="role"]:checked');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
  const role = roleInput ? roleInput.value : '';

  let hasError = false;

  // 1. Name validation
  if (!name) {
    showFieldError('reg-name-error', 'Name cannot be empty.');
    markFieldInvalid(nameInput);
    hasError = true;
  }

  // 2 & 3. Email validation
  if (!email) {
    showFieldError('reg-email-error', 'Email cannot be empty.');
    markFieldInvalid(emailInput);
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError('reg-email-error', 'Please enter a valid email address.');
    markFieldInvalid(emailInput);
    hasError = true;
  }

  // 4 & 5. Password validation
  if (!password) {
    showFieldError('reg-password-error', 'Password cannot be empty.');
    markFieldInvalid(passwordInput);
    hasError = true;
  } else if (password.length < 6) {
    showFieldError('reg-password-error', 'Password must contain at least 6 characters.');
    markFieldInvalid(passwordInput);
    hasError = true;
  }

  // 6. Confirm password validation
  if (!confirmPassword) {
    showFieldError('reg-confirm-password-error', 'Please confirm your password.');
    markFieldInvalid(confirmPasswordInput);
    hasError = true;
  } else if (password !== confirmPassword) {
    showFieldError('reg-confirm-password-error', 'Passwords do not match.');
    markFieldInvalid(confirmPasswordInput);
    hasError = true;
  }

  // 7. Role selection validation
  if (!role || (role !== 'customer' && role !== 'owner')) {
    showAlertBanner('Please select an account type (Customer or Owner).', 'danger');
    hasError = true;
  }

  if (hasError) {
    return;
  }

  // Duplicate email check in localStorage (dynamicRentUsers)
  const existingUsers = getRegisteredUsers();
  const emailExists = existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase());

  if (emailExists) {
    showFieldError('reg-email-error', 'This email is already registered.');
    markFieldInvalid(emailInput);
    showAlertBanner('This email is already registered. Please sign in or use another email.', 'danger');
    return;
  }

  // Generate unique ID
  const newUserId = generateUniqueId(role);

  // Construct new user object
  const newUser = {
    id: newUserId,
    name: name,
    email: email,
    password: password,
    role: role
  };

  // Save to localStorage under 'dynamicRentUsers'
  existingUsers.push(newUser);
  localStorage.setItem('dynamicRentUsers', JSON.stringify(existingUsers));

  // Show success alert & disable submit button
  showAlertBanner('Account created successfully! Redirecting to login...', 'success');
  
  const submitBtn = document.getElementById('register-submit-btn');
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

  // Redirect to login.html after 1.2s
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 1200);
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
 * Helper to validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

/**
 * Unique ID generator for Customer and Owner
 * @param {string} role 
 * @returns {string}
 */
function generateUniqueId(role) {
  const prefix = role === 'owner' ? 'OWN' : 'USR';
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Show inline error message beneath input
 * @param {string} elementId 
 * @param {string} message 
 */
function showFieldError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

/**
 * Mark input box as invalid with red border
 * @param {HTMLElement} inputEl 
 */
function markFieldInvalid(inputEl) {
  if (inputEl) {
    inputEl.classList.add('is-invalid');
  }
}

/**
 * Clear all inline error messages and reset input borders
 */
function clearAllErrors() {
  const errorElements = document.querySelectorAll('.field-error');
  errorElements.forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });

  const inputs = document.querySelectorAll('.form-control');
  inputs.forEach(input => {
    input.classList.remove('is-invalid');
  });
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
 * Setup Show/Hide password toggle buttons for password fields
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
