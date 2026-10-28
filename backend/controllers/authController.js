const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dynamicrent_jwt_default_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT for an authenticated user
 * @param {Object} user User document
 * @returns {string} JWT Token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      customId: user.customId || null,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Helper to validate email format
 * @param {string} email 
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

/**
 * @desc    Register a new user account (Customer or Owner)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name cannot be empty.'
      });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Email cannot be empty.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password cannot be empty.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 6 characters.'
      });
    }

    const normalizedRole = (role || 'customer').toString().trim().toLowerCase();
    if (normalizedRole !== 'customer' && normalizedRole !== 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid account type (customer or owner).'
      });
    }

    // 2. Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please sign in or use another email.'
      });
    }

    // 3. Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Generate custom ID compatible with frontend conventions
    const prefix = normalizedRole === 'owner' ? 'OWN' : 'USR';
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const customId = `${prefix}_${timestamp}_${randomSuffix}`;

    // 5. Create new User
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole,
      customId
    });

    // 6. Generate JWT token
    const token = generateToken(newUser);

    // 7. Return sanitized response (never return passwordHash)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.customId || newUser._id.toString(),
        _id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      // MongoDB duplicate key error
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please sign in or use another email.'
      });
    }

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    console.error('[AuthController] Error during registration:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while registering new account',
      error: err.message
    });
  }
};

/**
 * @desc    Authenticate user and return JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by normalized email and explicitly select passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email, password or role.'
      });
    }

    // Role verification (if role is provided)
    if (role) {
      const normalizedRole = role.toString().trim().toLowerCase();
      if (user.role.toLowerCase() !== normalizedRole) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email, password or role.'
        });
      }
    }

    // Verify password via bcrypt
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email, password or role.'
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return sanitized response (never return passwordHash)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.customId || user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('[AuthController] Error during login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying credentials',
      error: err.message
    });
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires JWT)
 */
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user.customId || req.user._id.toString(),
        _id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt
      }
    });
  } catch (err) {
    console.error('[AuthController] Error in getMe:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving user profile'
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};
