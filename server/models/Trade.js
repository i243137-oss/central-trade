import mongoose from 'mongoose';

/**
 * Trade Model
 * Implements R03 Matching Execution Results
 */
const tradeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  buyInstructionId: { type: String, required: true, index: true },
  sellInstructionId: { type: String, required: true, index: true },
  buyerUserId: { type: String, required: true, index: true },
  sellerUserId: { type: String, required: true, index: true },
  stockId: { type: String, required: true, index: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
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

export const Trade = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);
export default Trade;
