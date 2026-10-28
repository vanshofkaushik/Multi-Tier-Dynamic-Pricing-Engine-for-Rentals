const mongoose = require('mongoose');

/**
 * Booking Schema for DynamicRent
 * Represents a customer's rental booking reservation for a specific property.
 * 
 * SECURITY & ARCHITECTURAL NOTES:
 * - Authentication and authorization are NOT yet implemented in this milestone.
 * - Customer verification and owner approval authorization checks will be added in upcoming milestones.
 * - Total price is calculated and enforced on the server to prevent client-side tampering.
 */
const bookingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required']
    },
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
      trim: true
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required']
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
      validate: {
        validator: function (value) {
          // Check-out must be strictly after check-in
          return !this.checkIn || new Date(value) > new Date(this.checkIn);
        },
        message: 'Check-out date must be strictly after check-in date'
      }
    },
    guests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'Number of guests must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Guests must be an integer value'
      }
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price must be a non-negative number']
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Confirmed', 'Rejected', 'Cancelled'],
        message: '{VALUE} is not a valid booking status (allowed: Pending, Confirmed, Rejected, Cancelled)'
      },
      default: 'Pending',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common queries: filtering by customer, property, or status
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ propertyId: 1, status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
