import mongoose from 'mongoose';

/**
 * Log Model
 * CTS Audit Trail & System Activity Log
 */
const logSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  action: { type: String, required: true, index: true },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

export const Log = mongoose.models.Log || mongoose.model('Log', logSchema);
export default Log;
