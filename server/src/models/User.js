import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      unique: true, // creates a unique index, the real guarantee against duplicate accounts
    },
    // Only the bcrypt hash is stored, never the password itself. `select: false` means
    // normal queries leave it out; code that needs it must ask with .select('+passwordHash').
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true, // adds `id` (string form of _id)
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export const User = mongoose.model('User', userSchema);
