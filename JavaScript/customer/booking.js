/**
 * DynamicRent - Customer Module: Booking Processing (js/customer/booking.js)
 * Manages property ID query extraction, date selection constraints, live nightly and total calculations,
 * guest validation, duplicate booking prevention, price snapshotting, and storage persistence.
 */

let activeProperty = null;
let currentCustomer = null;

document.addEventListener('DOMContentLoaded', () => {
  initBookingPage();
});

/**
 * Initialize booking page state, load property, set date bounds and attach listeners
 */
function initBookingPage() {
  try {
    // 1. Ensure property dataset is initialized in storage
    if (typeof initDefaultProperties === 'function') {
      initDefaultProperties();
    }

    // 2. Fetch authenticated customer from session
    currentCustomer = StorageUtils.getCurrentUser();
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

    // 4. Retrieve property from storage
    activeProperty = StorageUtils.getPropertyById(propertyId);

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

  const imgEl = document.getElementById('prop-preview-img');
  if (imgEl) {
    imgEl.src = property.image || fallbackImg;
    imgEl.alt = property.name;
    imgEl.onerror = function() {
      this.onerror = null;
      this.src = fallbackImg;
    };
  }

  const typeEl = document.getElementById('prop-preview-type');
  if (typeEl) typeEl.textContent = property.type || 'Stay';

  const nameEl = document.getElementById('prop-preview-name');
  if (nameEl) nameEl.textContent = property.name;

  const ratingEl = document.getElementById('prop-preview-rating');
  if (ratingEl) ratingEl.textContent = property.rating ? property.rating.toFixed(1) : '4.8';

  const reviewsEl = document.getElementById('prop-preview-reviews');
  if (reviewsEl) reviewsEl.textContent = `(${property.reviews || 0} reviews)`;

  const locEl = document.getElementById('prop-preview-location');
  if (locEl) {
    const locText = property.area 
      ? `${property.area}, ${property.location}, India` 
      : `${property.location}, India`;
    locEl.textContent = locText;
  }

  const maxGuestsEl = document.getElementById('prop-preview-maxguests');
  if (maxGuestsEl) maxGuestsEl.textContent = `${property.guests || 2} Max Guests`;

  const bedEl = document.getElementById('prop-preview-bedrooms');
  if (bedEl) bedEl.textContent = `${property.bedrooms || 1} Beds`;

  const bathEl = document.getElementById('prop-preview-bathrooms');
  if (bathEl) bathEl.textContent = `${property.bathrooms || 1} Baths`;

  const priceVal = property.currentPrice || property.pricePerNight || 0;
  const priceEl = document.getElementById('prop-preview-price');
  if (priceEl) priceEl.textContent = `₹${priceVal.toLocaleString('en-IN')}`;

  const statusEl = document.getElementById('prop-preview-status');
  if (statusEl) {
    statusEl.textContent = property.status === 'available' ? 'Available' : 'Unavailable';
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

  // Populate guest selector up to property.guests
  if (guestSelect) {
    guestSelect.innerHTML = '';
    const maxGuests = property.guests || 4;
    for (let i = 1; i <= maxGuests; i++) {
      const option = document.createElement('option');
      option.value = i.toString();
      option.textContent = i === 1 ? '1 Guest' : `${i} Guests${i === maxGuests ? ' (Max)' : ''}`;
      if (i === 1) option.selected = true;
      guestSelect.appendChild(option);
    }
  }

  if (guestLimitHint) {
    guestLimitHint.textContent = `Maximum ${property.guests || 2} guests allowed for this property.`;
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

  const ratePerNight = activeProperty.currentPrice || activeProperty.pricePerNight || 0;
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
 * Handle booking submission with validation, duplicate check, and price snapshot
 * @param {Event} event 
 */
function handleBookingSubmit(event) {
  if (event) event.preventDefault();

  hideBookingAlert();

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
    return;
  }

  const calculation = calculateLivePrice();
  if (!calculation || calculation.nights < 1) {
    showBookingAlert('Check-out date must be at least 1 night after check-in date.', 'error');
    return;
  }

  // Generate unique booking ID
  const bookingId = StorageUtils.generateBookingId();

  // Construct complete booking object with immutable price snapshot
  const newBooking = {
    id: bookingId,
    propertyId: activeProperty.id,
    propertyName: activeProperty.name,
    propertyLocation: activeProperty.area ? `${activeProperty.area}, ${activeProperty.location}` : activeProperty.location,
    propertyImage: activeProperty.image || '',
    customerId: currentCustomer.id,
    customerName: currentCustomer.name,
    customerEmail: currentCustomer.email,

    checkIn: checkIn,
    checkOut: checkOut,

    guests: guests,
    nights: calculation.nights,

    // PRICE SNAPSHOT: saved at time of booking
    pricePerNight: calculation.ratePerNight,
    subtotal: calculation.subtotal,
    cleaningFee: calculation.cleaningFee,
    serviceFee: calculation.serviceFee,
    totalPrice: calculation.totalPrice,

    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // Persist booking into dynamicRentBookings in localStorage
  StorageUtils.addBooking(newBooking);

  // Present the success modal
  showBookingSuccessModal(newBooking);
}

/**
 * Display confirmation modal with booking details
 * @param {Object} booking 
 */
function showBookingSuccessModal(booking) {
  const modalEl = document.getElementById('booking-success-modal');
  if (!modalEl) return;

  const idEl = document.getElementById('success-booking-id');
  if (idEl) idEl.textContent = booking.id;

  const nameEl = document.getElementById('success-prop-name');
  if (nameEl) nameEl.textContent = booking.propertyName;

  const datesEl = document.getElementById('success-dates');
  if (datesEl) {
    const formattedIn = DateUtils.formatDate(booking.checkIn);
    const formattedOut = DateUtils.formatDate(booking.checkOut);
    datesEl.textContent = `${formattedIn} → ${formattedOut}`;
  }

  const guestsNightsEl = document.getElementById('success-guests-nights');
  if (guestsNightsEl) {
    const guestText = booking.guests === 1 ? '1 Guest' : `${booking.guests} Guests`;
    const nightText = booking.nights === 1 ? '1 Night' : `${booking.nights} Nights`;
    guestsNightsEl.textContent = `${guestText} • ${nightText}`;
  }

  const totalEl = document.getElementById('success-total-price');
  if (totalEl) {
    totalEl.textContent = `₹${booking.totalPrice.toLocaleString('en-IN')}`;
  }

  const statusEl = document.getElementById('success-status');
  if (statusEl) {
    statusEl.textContent = '🟡 Pending';
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
