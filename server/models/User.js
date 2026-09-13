import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['USER', 'SYSTEM_MANAGER'], default: 'USER', required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
