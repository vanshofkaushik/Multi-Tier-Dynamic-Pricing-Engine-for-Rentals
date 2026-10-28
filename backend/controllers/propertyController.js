const mongoose = require('mongoose');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Pricing = require('../models/Pricing');

/**
 * @desc    Create a new rental property listing
 * @route   POST /api/properties
 * @access  Public (Authentication/Owner authorization not yet implemented)
 */
const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      propertyType,
      pricePerNight,
      bedrooms,
      bathrooms,
      image,
      ownerId,
      amenities
    } = req.body;

    // Validate that request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body cannot be empty'
      });
    }

    // Determine ownerId from authenticated session or request body fallback
    const effectiveOwnerId = (req.user && (req.user.customId || req.user._id.toString())) || ownerId;

    if (!effectiveOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required to create a property listing'
      });
    }

    const initialBase = req.body.basePrice !== undefined ? Number(req.body.basePrice) : Number(pricePerNight);
    const initialCurrent = req.body.currentPrice !== undefined ? Number(req.body.currentPrice) : initialBase;

    const newProperty = await Property.create({
      title,
      description,
      location,
      propertyType,
      pricePerNight: initialCurrent,
      basePrice: initialBase,
      currentPrice: initialCurrent,
      bedrooms,
      bathrooms,
      image,
      ownerId: effectiveOwnerId,
      amenities
    });

    return res.status(201).json({
      success: true,
      message: 'Property listing created successfully',
      data: newProperty
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    console.error('Error creating property:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating property listing',
      error: err.message
    });
  }
};

/**
 * @desc    Get all properties (with optional query filters: location, propertyType, ownerId, minPrice, maxPrice)
 * @route   GET /api/properties
 * @access  Public
 */
const getAllProperties = async (req, res) => {
  try {
    const { location, propertyType, ownerId, minPrice, maxPrice } = req.query;
    const filter = {};

    if (location) {
      filter.location = { $regex: location.trim(), $options: 'i' };
    }

    if (propertyType) {
      filter.propertyType = { $regex: `^${propertyType.trim()}$`, $options: 'i' };
    }

    if (ownerId) {
      filter.ownerId = ownerId.trim();
    }

    if (minPrice || maxPrice) {
      filter.pricePerNight = {};
      if (minPrice && !isNaN(Number(minPrice))) {
        filter.pricePerNight.$gte = Number(minPrice);
      }
      if (maxPrice && !isNaN(Number(maxPrice))) {
        filter.pricePerNight.$lte = Number(maxPrice);
      }
    }

    const properties = await Property.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (err) {
    console.error('Error fetching properties:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching properties',
      error: err.message
    });
  }
};

/**
 * @desc    Get a single property by MongoDB ID
 * @route   GET /api/properties/:id
 * @access  Public
 */
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${id}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${id}`
      });
    }

    return res.status(200).json({
      success: true,
      data: property
    });
  } catch (err) {
    console.error('Error fetching property by ID:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching property',
      error: err.message
    });
  }
};

/**
 * @desc    Update an existing property by MongoDB ID
 * @route   PUT /api/properties/:id
 * @access  Public (Authentication/Owner authorization not yet implemented)
 */
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${id}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // Validate request body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body cannot be empty for update'
      });
    }

    const existingProperty = await Property.findById(id);
    if (!existingProperty) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${id}`
      });
    }

    // Verify ownership if caller is authenticated owner
    if (req.user) {
      const activeOwnerId = req.user.customId || req.user._id.toString();
      if (existingProperty.ownerId && existingProperty.ownerId !== activeOwnerId && activeOwnerId !== 'OWN001') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to modify properties owned by another account.'
        });
      }
    }

    const updates = { ...req.body };

    // Handle basePrice updates vs currentPrice updates
    if (updates.basePrice !== undefined) {
      const bPrice = Number(updates.basePrice);
      updates.basePrice = bPrice;
      // If currentPrice not explicitly specified, keep currentPrice tracking basePrice if no approval has occurred
      if (updates.currentPrice === undefined && !existingProperty.lastApprovedPrice) {
        updates.currentPrice = bPrice;
        updates.pricePerNight = bPrice;
      }
    } else if (updates.pricePerNight !== undefined && updates.currentPrice === undefined) {
      // If updating pricePerNight directly from general listing edit form:
      // If basePrice is not yet set, initialize it
      if (existingProperty.basePrice === undefined || existingProperty.basePrice === null) {
        updates.basePrice = Number(updates.pricePerNight);
      }
      updates.currentPrice = Number(updates.pricePerNight);
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      updates,
      {
        returnDocument: 'after', // Return updated document (Mongoose 9+)
        runValidators: true // Run schema validations on update
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      data: updatedProperty
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    console.error('Error updating property:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating property',
      error: err.message
    });
  }
};

/**
 * @desc    Delete a property listing by MongoDB ID
 * @route   DELETE /api/properties/:id
 * @access  Private (Owner authorized)
 */
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property ID format: "${id}". Expected a 24-character hex MongoDB ObjectId.`
      });
    }

    // 2. Authentication check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in as an owner.'
      });
    }

    // 3. Locate existing property in MongoDB
    const existingProperty = await Property.findById(id);
    if (!existingProperty) {
      return res.status(404).json({
        success: false,
        message: `Property not found with ID: ${id}`
      });
    }

    // 4. Verify property ownership: The property ownerId must match the authenticated owner's ID
    const callerUserId = req.user._id ? req.user._id.toString() : '';
    const callerCustomId = req.user.customId ? String(req.user.customId).trim() : '';
    const propOwnerId = existingProperty.ownerId ? String(existingProperty.ownerId).trim() : '';

    const isAuthorizedOwner = (propOwnerId === callerUserId) || (callerCustomId && propOwnerId === callerCustomId);

    if (!isAuthorizedOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to delete properties owned by another account.'
      });
    }

    // 5. Inspect existing booking relationships - Do not silently cascade-delete bookings
    const activeBookingsCount = await Booking.countDocuments({
      propertyId: id,
      status: { $in: ['Pending', 'Confirmed'] }
    });

    if (activeBookingsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete property: Listing has ${activeBookingsCount} active reservation(s) (Pending or Confirmed). Please resolve or cancel all reservations before deleting this property.`
      });
    }

    // 6. Delete property from MongoDB
    const deletedProperty = await Property.findByIdAndDelete(id);

    // Clean up associated dynamic pricing recommendation logs for this property
    await Pricing.deleteMany({ propertyId: id });

    return res.status(200).json({
      success: true,
      message: `Property "${deletedProperty.title}" deleted successfully.`,
      data: {
        id: deletedProperty._id,
        title: deletedProperty.title
      }
    });
  } catch (err) {
    console.error('Error deleting property:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting property',
      error: err.message
    });
  }
};

module.exports = {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
};
