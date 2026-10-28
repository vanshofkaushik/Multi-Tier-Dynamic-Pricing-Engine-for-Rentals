/**
 * DynamicRent - Customer Module: Booking Processing (js/customer/booking.js)
 * Manages property ID query extraction, date selection constraints, live nightly and total calculations,
 * guest validation, duplicate booking prevention, price snapshotting, dynamic pricing quote, and API submission.
 */

let activeProperty = null;
let currentCustomer = null;
let pricingQuoteDebounce = null;

document.addEventListener('DOMContentLoaded', () => {
  initBookingPage();
});

/**
 * Initialize booking page state, load property, set date bounds and attach listeners
 */
async function initBookingPage() {
  try {
    // 1. Ensure property dataset is initialized in storage if local mock helper exists
    if (typeof initDefaultProperties === 'function') {
      initDefaultProperties();
    }

    // 2. Fetch authenticated customer from session
    if (typeof StorageUtils !== 'undefined' && typeof StorageUtils.getCurrentUser === 'function') {
      currentCustomer = StorageUtils.getCurrentUser();
    } else if (typeof getCurrentUser === 'function') {
      currentCustomer = getCurrentUser();
    }

    if (!currentCustomer || currentCustomer.role !== 'customer') {
      console.warn('User not authenticated as customer. Redirecting to login.');
      redirectToLogin();
      return;
    }

    // 3. Extract 'id' query parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');

    if (!propertyId) {
      showBookingError('No Property Selected', 'Please browse our properties catalog and select a property to book.');
      return;
    }

    // Hide booking content grid and error state before fetching
    const contentContainer = document.getElementById('booking-content-grid');
    const errorContainer = document.getElementById('booking-error-state');
    if (contentContainer) contentContainer.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'none';

    // 4. Retrieve property strictly from ApiClient (backend MongoDB)
    if (window.ApiClient && typeof window.ApiClient.getPropertyById === 'function') {
      try {
        console.log(`[Booking Property Source: Requesting property ${propertyId} from backend API...]`);
        activeProperty = await window.ApiClient.getPropertyById(propertyId);
        console.log('[Booking Property Source: Backend API returned property]', activeProperty);
      } catch (apiErr) {
        console.error('[Booking Property Source: None - Backend Offline/Error]', apiErr.message);
        showBookingError(
          'Unable to connect to the server. Please try again.',
          'Unable to connect to the server. Please try again.'
        );
        return;
      }
    } else {
      showBookingError('System Error', 'API Client is unavailable. Please reload the page.');
      return;
    }

    if (contentContainer) contentContainer.style.display = 'grid';

    if (!activeProperty) {
      showBookingError('Property Not Found', `The requested property ID "${propertyId}" does not exist in our catalog.`);
      return;
    }

    if (activeProperty.status === 'unavailable') {
      showBookingError('Property Currently Unavailable', 'This property is currently not accepting new booking requests.');
      return;
    }

    // 5. Render property summary in left sidebar
    renderPropertyPreview(activeProperty);

    // 6. Setup booking form constraints and guest dropdown
    setupBookingForm(activeProperty);

    // 7. Initial calculation
    calculateLivePrice();

  } catch (err) {
    console.error('Error initializing booking page:', err);
    showBookingError('Unexpected Error', 'Could not initialize booking system. Please try again.');
  }
}

/**
 * Render property preview card in the left sidebar
 * @param {Object} property 
 */
function renderPropertyPreview(property) {
  const fallbackImg = typeof PROPERTY_IMAGE_FALLBACK !== 'undefined' 
    ? PROPERTY_IMAGE_FALLBACK 
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80';

  const propName = property.name || property.title || 'Untitled Stay';
  const propType = property.type || property.propertyType || 'Stay';

  const imgEl = document.getElementById('prop-preview-img');
  if (imgEl) {
    imgEl.src = property.image || fallbackImg;
    imgEl.alt = propName;
    imgEl.onerror = function() {
      this.onerror = null;
      this.src = fallbackImg;
    };
  }

  const typeEl = document.getElementById('prop-preview-type');
  if (typeEl) typeEl.textContent = propType;

  const nameEl = document.getElementById('prop-preview-name');
  if (nameEl) nameEl.textContent = propName;

  const ratingEl = document.getElementById('prop-preview-rating');
  if (ratingEl) ratingEl.textContent = property.rating ? property.rating.toFixed(1) : '4.8';

  const reviewsEl = document.getElementById('prop-preview-reviews');
  if (reviewsEl) reviewsEl.textContent = `(${property.reviews || 0} reviews)`;

  const locEl = document.getElementById('prop-preview-location');
  if (locEl) {
    const locText = property.area 
      ? `${property.area}, ${property.location}, India` 
      : `${property.location || 'India'}`;
    locEl.textContent = locText;
  }

  const maxGuests = property.guests || (property.bedrooms ? Math.max(2, property.bedrooms * 2) : 4);
  const maxGuestsEl = document.getElementById('prop-preview-maxguests');
  if (maxGuestsEl) maxGuestsEl.textContent = `${maxGuests} Max Guests`;

  const bedEl = document.getElementById('prop-preview-bedrooms');
  if (bedEl) bedEl.textContent = `${property.bedrooms || 1} Beds`;

  const bathEl = document.getElementById('prop-preview-bathrooms');
  if (bathEl) bathEl.textContent = `${property.bathrooms || 1} Baths`;

  const priceVal = (property.pricePerNight !== undefined ? property.pricePerNight : (property.currentPrice || 0));
  const priceEl = document.getElementById('prop-preview-price');
  if (priceEl) priceEl.textContent = `₹${priceVal.toLocaleString('en-IN')}`;

  const statusEl = document.getElementById('prop-preview-status');
  if (statusEl) {
    statusEl.textContent = property.status === 'unavailable' ? 'Unavailable' : 'Available';
  }
}

/**
 * Configure check-in / check-out minimum dates and guest options
 * @param {Object} property 
 */
function setupBookingForm(property) {
  const checkinInput = document.getElementById('checkin-date');
  const checkoutInput = document.getElementById('checkout-date');
  const guestSelect = document.getElementById('guest-count');
  const guestLimitHint = document.getElementById('guest-limit-hint');

  const todayStr = DateUtils.getTodayDateString();
  const tomorrowStr = DateUtils.getTomorrowDateString(todayStr);

  // Set minimum date bounds
  if (checkinInput) {
    checkinInput.min = todayStr;
    checkinInput.value = todayStr;
  }

  if (checkoutInput) {
    checkoutInput.min = tomorrowStr;
    checkoutInput.value = tomorrowStr;
  }

  // Populate guest selector up to capacity
  const maxGuests = property.guests || (property.bedrooms ? Math.max(2, property.bedrooms * 2) : 4);
  if (guestSelect) {
    guestSelect.innerHTML = '';
    for (let i = 1; i <= maxGuests; i++) {
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = i === 1 ? '1 Guest' : `${i} Guests${i === maxGuests ? ' (Max)' : ''}`;
      if (i === 1) option.selected = true;
      guestSelect.appendChild(option);
    }
  }

  if (guestLimitHint) {
    guestLimitHint.textContent = `Maximum ${maxGuests} guests allowed for this property.`;
  }

  // Attach live calculation listeners
  if (checkinInput) {
    checkinInput.addEventListener('change', onCheckInDateChange);
    checkinInput.addEventListener('input', calculateLivePrice);
  }

  if (checkoutInput) {
    checkoutInput.addEventListener('change', calculateLivePrice);
    checkoutInput.addEventListener('input', calculateLivePrice);
  }

  if (guestSelect) {
    guestSelect.addEventListener('change', calculateLivePrice);
  }
}

/**
 * When check-in date changes, automatically update check-out minimum date
 */
function onCheckInDateChange() {
  const checkinInput = document.getElementById('checkin-date');
  const checkoutInput = document.getElementById('checkout-date');

  if (!checkinInput || !checkoutInput) return;

  const checkinVal = checkinInput.value;
  if (checkinVal) {
    const nextDay = DateUtils.getTomorrowDateString(checkinVal);
    checkoutInput.min = nextDay;

    // If check-out is currently earlier than or equal to check-in, advance check-out
    if (!checkoutInput.value || checkoutInput.value <= checkinVal) {
      checkoutInput.value = nextDay;
    }
  }

  calculateLivePrice();
}

/**
 * Calculate live nights, subtotal, and total price without page refresh
 */
function calculateLivePrice() {
  if (!activeProperty) return;

  hideBookingAlert();

  const checkinInput = document.getElementById('checkin-date');
  const checkoutInput = document.getElementById('checkout-date');

  const checkinVal = checkinInput ? checkinInput.value : '';
  const checkoutVal = checkoutInput ? checkoutInput.value : '';

  const ratePerNight = (activeProperty.pricePerNight !== undefined ? activeProperty.pricePerNight : (activeProperty.currentPrice || 0));
  const nights = DateUtils.calculateNights(checkinVal, checkoutVal);

  const subtotal = ratePerNight * nights;
  const cleaningFee = 0;
  const serviceFee = 0;
  const totalPrice = subtotal + cleaningFee + serviceFee;

  // Update breakdown DOM elements
  const summaryRateEl = document.getElementById('summary-price-night');
  if (summaryRateEl) summaryRateEl.textContent = `₹${ratePerNight.toLocaleString('en-IN')}`;

  const summaryNightsEl = document.getElementById('summary-nights');
  if (summaryNightsEl) {
    summaryNightsEl.textContent = nights === 1 ? '1 night' : `${nights} nights`;
  }

  const liveBadge = document.getElementById('nights-live-badge');
  if (liveBadge) {
    liveBadge.textContent = nights === 1 ? '1 Night' : `${nights} Nights`;
  }

  const subtotalEl = document.getElementById('summary-subtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  const totalEl = document.getElementById('summary-total-price');
  if (totalEl) totalEl.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

  // Asynchronously query dynamic pricing quote if valid dates are entered
  const propId = activeProperty.id || activeProperty._id;
  if (propId && checkinVal && checkoutVal && checkoutVal > checkinVal && nights >= 1) {
    fetchDynamicPricingQuote(propId, checkinVal, checkoutVal, nights);
  } else {
    const noticeBox = document.getElementById('dynamic-pricing-notice');
    if (noticeBox) noticeBox.style.display = 'none';
  }

  return {
    ratePerNight,
    nights,
    subtotal,
    cleaningFee,
    serviceFee,
    totalPrice
  };
}

/**
 * Fetch dynamic price quote recommendation from backend
 * @param {string} propertyId 
 * @param {string} checkIn 
 * @param {string} checkOut 
 * @param {number} nights 
 */
function fetchDynamicPricingQuote(propertyId, checkIn, checkOut, nights) {
  if (!window.ApiClient || typeof window.ApiClient.getPricingQuote !== 'function') return;

  clearTimeout(pricingQuoteDebounce);
  pricingQuoteDebounce = setTimeout(async () => {
    try {
      const quote = await window.ApiClient.getPricingQuote(propertyId, checkIn, checkOut);
      const noticeBox = document.getElementById('dynamic-pricing-notice');
      const rateEl = document.getElementById('dynamic-suggested-rate');
      const textEl = document.getElementById('dynamic-notice-text');

      if (quote && noticeBox && rateEl) {
        const nightlyRate = quote.suggestedPricePerNight || quote.calculatedPrice || quote.basePrice;
        const totalEstimated = quote.totalEstimatedPrice || (nightlyRate ? nightlyRate * nights : null);

        let displayText = `₹${nightlyRate.toLocaleString('en-IN')}/night`;
        if (totalEstimated) {
          displayText += ` (Est. ₹${totalEstimated.toLocaleString('en-IN')})`;
        }
        rateEl.textContent = displayText;

        if (textEl && quote.notice) {
          textEl.textContent = `${quote.notice} Reservation total is charged at standard rate above.`;
        }
        noticeBox.style.display = 'block';
      }
    } catch (err) {
      // Silently keep dynamic notice hidden if quote API fails or dates are invalid
      const noticeBox = document.getElementById('dynamic-pricing-notice');
      if (noticeBox) noticeBox.style.display = 'none';
    }
  }, 250);
}

/**
 * Handle booking submission with validation, duplicate check, and server creation
 * @param {Event} event 
 */
async function handleBookingSubmit(event) {
  if (event) event.preventDefault();

  hideBookingAlert();

  const successModal = document.getElementById('booking-success-modal');
  if (successModal) {
    successModal.style.display = 'none';
  }

  const submitBtn = document.getElementById('submit-booking-btn') || document.getElementById('btn-submit-booking');
  const resetSubmitBtn = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Submit Booking Request</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
    }
  };

  if (submitBtn && submitBtn.disabled) {
    return; // Already submitting
  }

  if (!activeProperty) {
    showBookingAlert('Property data is unavailable.', 'error');
    return;
  }

  if (!currentCustomer || currentCustomer.role !== 'customer') {
    showBookingAlert('Please log in as a customer to submit a booking request.', 'error');
    return;
  }

  const checkinInput = document.getElementById('checkin-date');
  const checkoutInput = document.getElementById('checkout-date');
  const guestSelect = document.getElementById('guest-count');

  const checkIn = checkinInput ? checkinInput.value : '';
  const checkOut = checkoutInput ? checkoutInput.value : '';
  const guests = guestSelect ? parseInt(guestSelect.value, 10) : 1;

  // Run comprehensive validation
  const validationResult = ValidationUtils.validateBooking({
    property: activeProperty,
    customer: currentCustomer,
    checkIn,
    checkOut,
    guests
  });

  if (!validationResult.valid) {
    showBookingAlert(validationResult.error, 'error');
    resetSubmitBtn();
    return;
  }

  const calculation = calculateLivePrice();
  if (!calculation || calculation.nights < 1) {
    showBookingAlert('Check-out date must be at least 1 night after check-in date.', 'error');
    resetSubmitBtn();
    return;
  }

  // Disable button to prevent double-click duplication
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Submitting Request...</span>`;
  }

  try {
    const propId = activeProperty._id || activeProperty.id;
    const custId = currentCustomer.id || currentCustomer._id || currentCustomer.email;

    if (!window.ApiClient || typeof window.ApiClient.createBooking !== 'function') {
      throw new Error('API Client is not available. Please refresh the page.');
    }

    // Submit booking through ApiClient.createBooking
    // The backend calculates the final booking price strictly on the server
    const createdBooking = await window.ApiClient.createBooking({
      propertyId: propId,
      customerId: custId,
      checkIn: checkIn,
      checkOut: checkOut,
      guests: guests
    });

    // Verify a valid booking object containing a server-generated ID was returned
    if (!createdBooking || (!createdBooking.id && !createdBooking._id)) {
      throw new Error('Server did not return a valid booking confirmation.');
    }

    // Present the success modal strictly after confirmed backend creation
    showBookingSuccessModal(createdBooking);

  } catch (err) {
    console.error('Booking submission failed:', err);
    if (successModal) {
      successModal.style.display = 'none';
    }
    resetSubmitBtn();
    showBookingAlert(
      err.message || 'Unable to connect to DynamicRent server. Booking was NOT saved.',
      'error'
    );
  }
}

/**
 * Display confirmation modal with booking details
 * @param {Object} booking 
 */
function showBookingSuccessModal(booking) {
  const modalEl = document.getElementById('booking-success-modal');
  if (!modalEl) return;

  const idEl = document.getElementById('success-booking-id');
  if (idEl) idEl.textContent = booking.id || booking._id || 'Pending';

  const nameEl = document.getElementById('success-prop-name');
  if (nameEl) {
    nameEl.textContent = booking.propertyName || 
      (booking.propertyId && (booking.propertyId.title || booking.propertyId.name)) || 
      (activeProperty ? (activeProperty.name || activeProperty.title) : 'Rental Stay');
  }

  const datesEl = document.getElementById('success-dates');
  if (datesEl) {
    const formattedIn = DateUtils.formatDate(booking.checkIn);
    const formattedOut = DateUtils.formatDate(booking.checkOut);
    datesEl.textContent = `${formattedIn} → ${formattedOut}`;
  }

  const guestsNightsEl = document.getElementById('success-guests-nights');
  if (guestsNightsEl) {
    const guestNum = booking.guests || 1;
    const guestText = guestNum === 1 ? '1 Guest' : `${guestNum} Guests`;
    
    let nightCount = booking.nights;
    if (!nightCount && booking.checkIn && booking.checkOut) {
      nightCount = DateUtils.calculateNights(booking.checkIn, booking.checkOut);
    }
    const nightText = (nightCount === 1) ? '1 Night' : `${nightCount || 1} Nights`;
    guestsNightsEl.textContent = `${guestText} • ${nightText}`;
  }

  const totalEl = document.getElementById('success-total-price');
  if (totalEl) {
    const price = Number(booking.totalPrice !== undefined ? booking.totalPrice : 0);
    totalEl.textContent = `₹${price.toLocaleString('en-IN')}`;
  }

  const statusEl = document.getElementById('success-status');
  if (statusEl) {
    statusEl.textContent = `🟡 ${booking.status || 'Pending'}`;
    statusEl.className = 'badge badge-warning';
  }

  modalEl.style.display = 'flex';
}

/**
 * Display error banner inside the booking form
 * @param {string} message 
 * @param {string} [type] 'error' | 'warning'
 */
function showBookingAlert(message, type = 'error') {
  const alertEl = document.getElementById('booking-alert');
  if (!alertEl) return;

  alertEl.textContent = message;
  alertEl.className = type === 'error' ? 'booking-alert-banner alert-danger' : 'booking-alert-banner alert-warning';
  alertEl.style.display = 'block';
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide error banner
 */
function hideBookingAlert() {
  const alertEl = document.getElementById('booking-alert');
  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }
}

/**
 * Show major error state if property is not found or not available
 * @param {string} title 
 * @param {string} message 
 */
function showBookingError(title, message) {
  const errorContainer = document.getElementById('booking-error-state');
  const contentContainer = document.getElementById('booking-content-grid');

  if (contentContainer) contentContainer.style.display = 'none';
  if (errorContainer) {
    errorContainer.style.display = 'block';
    const titleEl = document.getElementById('booking-error-title');
    const descEl = document.getElementById('booking-error-desc');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = message;
  }
}
