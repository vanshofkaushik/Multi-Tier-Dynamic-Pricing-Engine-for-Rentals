const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Authentication Routes for DynamicRent
 * Base URL: /api/auth
 */

// POST /api/auth/register - Register a new customer or owner account
router.post('/register', register);

// POST /api/auth/login - Authenticate credentials and receive JWT token
router.post('/login', login);

// GET /api/auth/me - Retrieve authenticated user profile (requires Bearer token)
router.get('/me', protect, getMe);

module.exports = router;
