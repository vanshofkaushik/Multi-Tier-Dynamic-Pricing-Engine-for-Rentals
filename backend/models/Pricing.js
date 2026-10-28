const mongoose = require('mongoose');

/**
 * Pricing Schema for DynamicRent
 * Stores generated dynamic price quotes and historical pricing calculations.
 * 
 * IMPORTANT ARCHITECTURAL RULE:
 * This model records algorithmic suggestions. Creating or querying dynamic pricing quotes
 * DOES NOT mutate the base pricePerNight in the Property collection without explicit owner action.
 */
const pricingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required']
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price must be a non-negative number']
    },
    calculatedPrice: {
      type: Number,
      required: [true, 'Calculated price is required'],
      min: [0, 'Calculated price must be a non-negative number']
    },
    demandScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    occupancyRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    bookingCount: {
      type: Number,
      default: 0,
      min: 0
    },
    leadTimeDays: {
      type: Number,
      required: [true, 'Lead time in days is required'],
      min: 0
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: [1, 'Duration must be at least 1 day']
    },
    multipliers: {
      occupancyAdjustment: { type: Number, default: 0 },
      leadTimeAdjustment: { type: Number, default: 0 },
      durationAdjustment: { type: Number, default: 0 },
      netMultiplier: { type: Number, default: 1.0 },
      clampedMultiplier: { type: Number, default: 1.0 }
    },
    totalEstimatedPrice: {
      type: Number,
      min: 0
    },
    isSuggestion: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for fast retrieval of property pricing history
pricingSchema.index({ propertyId: 1, createdAt: -1 });

const Pricing = mongoose.model('Pricing', pricingSchema);

module.exports = Pricing;
