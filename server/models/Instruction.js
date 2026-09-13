import mongoose from 'mongoose';

/**
 * Instruction Model
 * Implements R01 (Buy/Sell), R02 (Cancel), R05 (Outdated)
 */
const instructionSchema = new mongoose.Schema({
  _id: { type: String },
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  stockId: { type: String, required: true, index: true },
  type: { type: String, enum: ['BUY', 'SELL'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  remainingQuantity: { type: Number, required: true, min: 0 },
  respectedPrice: { type: Number, required: true, min: 0.01 },
  timestamp: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_FINISHED', 'TOTALLY_FINISHED', 'CANCELLED', 'EXPIRED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  frozenAmount: { type: Number, default: 0 },
  cancelledAt: { type: Date },
  expiredAt: { type: Date }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound index for matching engine queries (Price-Time Priority)
instructionSchema.index({ stockId: 1, type: 1, status: 1, respectedPrice: -1, timestamp: 1 });

export const Instruction = mongoose.models.Instruction || mongoose.model('Instruction', instructionSchema);
export default Instruction;
