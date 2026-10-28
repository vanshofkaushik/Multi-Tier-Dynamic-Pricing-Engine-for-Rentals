const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for DynamicRent
 * Stores authenticated customer and property owner accounts.
 * Passwords are encrypted as bcrypt hashes and never stored in plain text.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [60, 'Name cannot exceed 60 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never include password hash in query results by default
    },
    role: {
      type: String,
      required: [true, 'Account role is required'],
      enum: {
        values: ['customer', 'owner'],
        message: '{VALUE} is not a valid role. Allowed roles: customer, owner'
      },
      default: 'customer',
      lowercase: true,
      trim: true
    },
    customId: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret.customId || ret._id.toString();
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: function (doc, ret) {
        ret.id = ret.customId || ret._id.toString();
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

/**
 * Compare an entered plaintext password against the stored bcrypt hash
 * @param {string} candidatePassword 
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.passwordHash) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
