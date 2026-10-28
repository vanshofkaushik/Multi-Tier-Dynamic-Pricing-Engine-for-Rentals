const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas using Mongoose
 * Reads MONGODB_URI from environment variables (backend/.env)
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables.\n' +
      'Please create a "backend/.env" file and configure your MongoDB Atlas connection string.\n' +
      'Reference: backend/.env.example'
    );
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB Connection Error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
