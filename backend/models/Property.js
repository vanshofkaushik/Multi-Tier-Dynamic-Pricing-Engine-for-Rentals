const mongoose = require('mongoose');

/**
 * Property Schema for DynamicRent
 * Represents a rental listing created by a property owner.
 * Note: Authentication and owner authorization will be linked in upcoming milestones.
 */
const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Property title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
      type: String,
      required: [true, 'Property description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long']
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    propertyType: {
      type: String,
      required: [true, 'Property type is required'],
      trim: true,
      enum: {
        values: ['Apartment', 'Villa', 'House', 'Studio', 'Condo', 'Other'],
        message: '{VALUE} is not a valid property type (allowed: Apartment, Villa, House, Studio, Condo, Other)'
      }
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price per night must be a positive number']
    },
    basePrice: {
      type: Number,
      min: [0, 'Base price must be a non-negative number']
    },
    currentPrice: {
      type: Number,
      min: [0, 'Current price must be a non-negative number']
    },
    lastApprovedPrice: {
      type: Number,
      min: [0, 'Last approved price must be a non-negative number']
    },
    lastPriceApprovedAt: {
      type: Date
    },
    bedrooms: {
      type: Number,
      required: [true, 'Number of bedrooms is required'],
      min: [0, 'Bedrooms cannot be negative'],
      default: 1
    },
    bathrooms: {
      type: Number,
      required: [true, 'Number of bathrooms is required'],
      min: [0, 'Bathrooms cannot be negative'],
      default: 1
    },
    image: {
      type: String,
      trim: true,
      default: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80'
    },
    ownerId: {
      type: String,
      required: [true, 'Owner ID is required'],
      trim: true
    },
    amenities: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save hook: ensure basePrice and currentPrice are initialized if missing
propertySchema.pre('save', function () {
  if (this.basePrice === undefined || this.basePrice === null) {
    this.basePrice = this.pricePerNight;
  }
  if (this.currentPrice === undefined || this.currentPrice === null) {
    this.currentPrice = this.pricePerNight || this.basePrice;
  }
  // Ensure pricePerNight is synchronized with currentPrice for seamless consumer compatibility
  if (this.currentPrice !== undefined && this.currentPrice !== null) {
    this.pricePerNight = this.currentPrice;
  }
});

// Post-init hook: normalize documents fetched from MongoDB that predate basePrice/currentPrice fields
propertySchema.post('init', function (doc) {
  if (doc.basePrice === undefined || doc.basePrice === null) {
    doc.basePrice = doc.pricePerNight;
  }
  if (doc.currentPrice === undefined || doc.currentPrice === null) {
    doc.currentPrice = doc.pricePerNight || doc.basePrice;
  }
});

// Index for frequent search queries by location and propertyType
propertySchema.index({ location: 1, propertyType: 1 });

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
