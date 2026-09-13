import mongoose from 'mongoose';

/**
 * Account Model
 * Implements Security Account for R06 Fund Freezing
 */
const accountSchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, unique: true, index: true },
  totalBalance: { type: Number, required: true, default: 0 },
  availableBalance: { type: Number, required: true, default: 0 },
  frozenBalance: { type: Number, required: true, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

export const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);
export default Account;
