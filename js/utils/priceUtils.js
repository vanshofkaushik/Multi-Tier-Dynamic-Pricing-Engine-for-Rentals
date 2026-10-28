/**
 * DynamicRent - Utilities: Price Calculations
 * Price formatting, dynamic multiplier computation, and tax/fee estimation helpers.
 */

const PriceUtils = {
  formatCurrency(amount) {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  calculateDynamicPrice(basePrice, demandFactor, occupancyFactor, seasonFactor) {
    // Dynamic algorithm logic will be implemented in Step 3
    return basePrice;
  }
};
