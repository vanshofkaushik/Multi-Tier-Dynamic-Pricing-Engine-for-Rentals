const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const propertyRoutes = require('./routes/propertyRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const authRoutes = require('./routes/authRoutes');
const seedDemoUsers = require('./services/demoSeedService');

const path = require('path');

// Load environment variables from backend/.env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware: Enable CORS for local frontend development (Live Server, http-server, etc.)
app.use(cors());

// Middleware: Parse JSON request bodies
app.use(express.json());

// Middleware: Disable client/browser caching on all dynamic API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Root endpoint for simple browser inspection
app.get('/', (req, res) => {
  res.json({
    message: 'DynamicRent Backend API is running',
    endpoints: {
      healthCheck: '/api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me'
      },
      properties: '/api/properties',
      bookings: '/api/bookings',
      pricing: '/api/pricing'
    }
  });
});

// GET /api/health - Health check endpoint (reports server & database state)
app.get('/api/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isConnected = mongoose.connection.readyState === 1;

  res.json({
    status: 'ok',
    message: 'DynamicRent Backend API is operational',
    database: {
      status: dbStates[mongoose.connection.readyState] || 'unknown',
      connected: isConnected,
      host: isConnected ? mongoose.connection.host : null,
      name: isConnected ? mongoose.connection.name : null
    },
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pricing', pricingRoutes);

// Handle undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Server Startup: Connect to MongoDB Atlas first, then start listening
const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();

    // 2. Ensure baseline demo accounts are securely seeded in MongoDB Atlas
    await seedDemoUsers();

    // 3. Start Express listener after DB connection succeeds
    app.listen(PORT, () => {
      console.log(`\n==============================================`);
      console.log(` DynamicRent Server running on http://localhost:${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/api/health`);
      console.log(` Auth endpoints: POST /api/auth/register, POST /api/auth/login`);
      console.log(`==============================================\n`);
    });
  } catch (err) {
    console.error('\n[DATABASE CONFIGURATION REQUIRED]');
    console.error(err.message);
    console.log('\nSteps to connect your MongoDB Atlas account:');
    console.log('1. Copy "backend/.env.example" to "backend/.env"');
    console.log('2. Replace the placeholder MONGODB_URI with your real connection string:');
    console.log('   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/dynamicrent?retryWrites=true&w=majority');
    console.log('3. Ensure your current IP is whitelisted in MongoDB Atlas Network Access.');
    console.log('4. Run "npm start" inside the backend/ folder.\n');
    process.exit(1);
  }
};

startServer();
