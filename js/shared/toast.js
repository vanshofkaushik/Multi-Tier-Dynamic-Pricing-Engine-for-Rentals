/**
 * DynamicRent - Shared Toast Notification System (js/shared/toast.js)
 * Step 10: Unified, accessible, and non-blocking toast notifications across Customer & Owner portals.
 */

const Toast = {
  containerId: 'dynamic-toast-container',

  /**
   * Get or create the toast container in DOM
   * @returns {HTMLElement}
   */
  getContainer() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Display a toast notification
   * @param {string} message 
   * @param {'success'|'error'|'warning'|'info'} [type] 
   * @param {number} [duration] In milliseconds (default: 3500)
   */
  show(message, type = 'info', duration = 3500) {
    if (typeof document === 'undefined') return;

    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.setAttribute('role', 'alert');

    // Select icon
    let icon = 'ℹ';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✕';
    else if (type === 'warning') icon = '⚠';

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icon}</span>
      <span class="toast-text">${message}</span>
      <button type="button" class="toast-close-btn" aria-label="Dismiss notification" style="background:none; border:none; color:inherit; opacity:0.6; cursor:pointer; font-size:1.1rem; line-height:1; padding:0 0 0 8px; margin-left:auto;">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.dismiss(toast);
    }

    container.appendChild(toast);

    // Auto dismiss timer
    const timer = setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    toast.dataset.timer = timer;
  },

  /**
   * Dismiss a toast with smooth slide-out transition
   * @param {HTMLElement} toast 
   */
  dismiss(toast) {
    if (!toast || toast.classList.contains('fade-out')) return;
    if (toast.dataset.timer) clearTimeout(Number(toast.dataset.timer));

    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 280);
  },

  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    this.show(message, 'error', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  }
};

// Global helper aliases
function showSuccess(message, duration) {
  Toast.success(message, duration);
}

function showError(message, duration) {
  Toast.error(message, duration);
}

function showWarning(message, duration) {
  Toast.warning(message, duration);
}

function showInfo(message, duration) {
  Toast.info(message, duration);
}
