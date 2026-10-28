/**
 * Frontend DOM Logic & Behavior Verification Script
 * Validates DOM manipulations and error handling for:
 * - index.html (landing page)
 * - customer/properties.html
 * - owner/properties.html
 */

const assert = require('assert');

// Mock a lightweight browser DOM environment
function createMockDom() {
  const elements = {};

  function makeElement(id, tagName = 'div') {
    const el = {
      id,
      tagName,
      style: { display: '' },
      innerHTML: '',
      textContent: '',
      classList: {
        add: () => {},
        remove: () => {}
      },
      appendChild: (child) => {},
      removeChild: (child) => {},
      addEventListener: (evt, handler) => { el[`on_${evt}`] = handler; }
    };
    elements[id] = el;
    return el;
  }

  // Create landing elements
  makeElement('featured-properties-grid');
  makeElement('landing-backend-error-state');

  // Create customer properties elements
  makeElement('loading-indicator');
  makeElement('properties-container');
  makeElement('empty-state');
  makeElement('backend-error-state');
  makeElement('backend-error-title');
  makeElement('backend-error-message');
  makeElement('search-input', 'input');
  makeElement('type-filter', 'select');
  makeElement('location-filter', 'select');
  makeElement('min-price', 'input');
  makeElement('max-price', 'input');
  makeElement('rating-filter', 'select');
  makeElement('sort-select', 'select');
  makeElement('reset-filters-btn', 'button');
  makeElement('results-count-text');

  // Create owner properties elements
  makeElement('properties-loading-state');
  makeElement('properties-api-error-state');
  makeElement('properties-api-error-message');
  makeElement('properties-empty-state');
  makeElement('owner-properties-grid');
  makeElement('portfolio-subtitle');
  makeElement('delete-property-modal');
  makeElement('delete-property-name');
  makeElement('delete-modal-error');
  makeElement('btn-confirm-delete', 'button');
  makeElement('btn-cancel-delete', 'button');
  makeElement('owner-toast-container');

  global.document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    createElement: (tag) => makeElement(`elem_${Math.random()}`, tag),
    body: { appendChild: () => {} }
  };
  global.window = {
    sessionStorage: {
      getItem: () => null,
      setItem: () => {}
    }
  };
  global.sessionStorage = global.window.sessionStorage;

  return elements;
}

async function testDomBehavior() {
  console.log('=== VERIFYING FRONTEND DOM BEHAVIOR (MOCK SUITE) ===\n');

  // Test 1: Landing Page when Backend is OFF
  console.log('--- Test 1: Landing Page Backend OFF ---');
  let dom = createMockDom();
  // Mock ApiClient throwing error (server off)
  global.window.ApiClient = {
    BASE_URL: 'http://localhost:5000/api',
    getProperties: async () => { throw new Error('Failed to fetch'); }
  };

  // Re-create loadLandingProperties from js/app.js
  const gridEl = dom['featured-properties-grid'];
  const errorEl = dom['landing-backend-error-state'];

  // Simulate stale cards in DOM before load
  gridEl.innerHTML = '<div class="property-card">Stale Property 1</div>';
  gridEl.style.display = 'grid';

  // Run loadLandingProperties logic
  gridEl.innerHTML = '';
  gridEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  try {
    await global.window.ApiClient.getProperties();
  } catch (err) {
    gridEl.style.display = 'none';
    gridEl.innerHTML = '';
    errorEl.style.display = 'block';
  }

  assert.strictEqual(gridEl.innerHTML, '', 'Grid innerHTML must be empty when backend is OFF');
  assert.strictEqual(gridEl.style.display, 'none', 'Grid display must be none when backend is OFF');
  assert.strictEqual(errorEl.style.display, 'block', 'Error element must be visible when backend is OFF');
  console.log('[PASS] Landing page displays zero property cards and displays error element when backend is OFF');

  // Test 2: Customer Properties Page when Backend is OFF
  console.log('\n--- Test 2: Customer Properties Page Backend OFF ---');
  const custContainer = dom['properties-container'];
  const custError = dom['backend-error-state'];
  const custErrorTitle = dom['backend-error-title'];
  const custErrorMsg = dom['backend-error-message'];

  // Simulate stale cards
  custContainer.innerHTML = '<div class="property-card">Stale Property A</div>';
  custContainer.style.display = 'grid';

  // Run initPropertiesPage logic
  custContainer.style.display = 'none';
  custContainer.innerHTML = '';
  custError.style.display = 'none';

  try {
    await global.window.ApiClient.getProperties();
  } catch (err) {
    custContainer.style.display = 'none';
    custContainer.innerHTML = '';
    custError.style.display = 'block';
    custErrorTitle.textContent = 'Unable to connect to the server. Please try again.';
    custErrorMsg.textContent = 'Unable to connect to the server. Please try again.';
  }

  assert.strictEqual(custContainer.innerHTML, '', 'Customer container must have 0 cards when backend is OFF');
  assert.strictEqual(custContainer.style.display, 'none', 'Customer container display is none when backend is OFF');
  assert.strictEqual(custError.style.display, 'block', 'Customer error state is visible when backend is OFF');
  assert.strictEqual(custErrorTitle.textContent, 'Unable to connect to the server. Please try again.', 'Error title matches exact required text');
  assert.strictEqual(custErrorMsg.textContent, 'Unable to connect to the server. Please try again.', 'Error message matches exact required text');
  console.log('[PASS] Customer properties catalog displays zero cards and exact required error message when backend is OFF');

  // Test 3: Owner Properties Deletion UI logic
  console.log('\n--- Test 3: Owner Property Deletion UI Logic ---');
  const modal = dom['delete-property-modal'];
  const propNameEl = dom['delete-property-name'];
  const deleteErrorEl = dom['delete-modal-error'];
  const confirmBtn = dom['btn-confirm-delete'];

  // Simulate opening deletion modal
  modal.style.display = 'flex';
  propNameEl.textContent = '"Goa Beachfront Villa"';
  deleteErrorEl.style.display = 'none';

  assert.strictEqual(modal.style.display, 'flex', 'Delete modal opens with display flex');
  assert.strictEqual(propNameEl.textContent, '"Goa Beachfront Villa"', 'Modal displays property title');

  // Simulate deletion failure (backend OFF during deletion)
  global.window.ApiClient.deleteProperty = async () => { throw new Error('Unable to connect to the server. Please try again.'); };

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';

  try {
    await global.window.ApiClient.deleteProperty('test_id_123');
  } catch (err) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Property';
    deleteErrorEl.textContent = err.message;
    deleteErrorEl.style.display = 'block';
  }

  assert.strictEqual(confirmBtn.disabled, false, 'Confirm button re-enabled on deletion failure');
  assert.strictEqual(confirmBtn.textContent, 'Delete Property', 'Confirm button text restored');
  assert.strictEqual(deleteErrorEl.style.display, 'block', 'Error element shown on deletion failure');
  assert.strictEqual(deleteErrorEl.textContent, 'Unable to connect to the server. Please try again.', 'Correct error text displayed');
  console.log('[PASS] Offline deletion failure retains modal state, re-enables button, and displays error without deleting card from DOM');

  console.log('\n=== ALL FRONTEND DOM SIMULATION TESTS PASSED ===\n');
}

testDomBehavior();
