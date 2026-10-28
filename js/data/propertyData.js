/**
 * DynamicRent - Data: Property Listings (js/data/propertyData.js)
 * Demo property dataset representing verified accommodations across Indian metropolitan locations.
 */

// Property Listings dataset (Neutralized - strictly loaded from MongoDB Atlas via API)
const INITIAL_PROPERTIES = [];


// Fallback image in case of network or image loading issues
const PROPERTY_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80";

/**
 * Clear stale cached property data from localStorage to ensure rendering
 * relies solely on the live backend API.
 */
function initDefaultProperties() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('dynamicRentProperties');
    }
  } catch (err) {
    // Ignore storage restrictions
  }
}

// Clear stale cached demo properties from localStorage
initDefaultProperties();

