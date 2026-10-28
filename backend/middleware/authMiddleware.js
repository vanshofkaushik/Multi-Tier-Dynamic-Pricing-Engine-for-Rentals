const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dynamicrent_jwt_default_secret_key_2026';

/**
 * Protect routes - Verifies JWT from the Authorization header (Bearer <token>)
 * Attaches authenticated user document to req.user (excluding passwordHash)
 */
const protect = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1].trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication token is missing.'
      });
    }

    // Verify token validity
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token. Please log in again.'
      });
    }

    // Find user in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Error during token verification:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying authentication credentials'
    });
  }
};

/**
 * Restrict access to specific roles (e.g. 'owner', 'customer')
 * @param  {...string} roles Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before role verification.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role "${req.user.role}" is not authorized to access this resource.`
      });
    }

    next();
  };
};

/**
 * Optional Protect - Attaches user to req.user if a valid token is provided,
 * but allows the request to continue if unauthenticated.
 */
const optionalProtect = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1].trim();
    }

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    } catch (tokenErr) {
      // Token is invalid/expired; proceed unauthenticated
    }

    next();
  } catch (err) {
    next();
  }
};

module.exports = {
  protect,
  authorize,
  optionalProtect
};
