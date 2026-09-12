import mongoose from 'mongoose';

/**
 * Stock Model
 * Implements R04 Rising & Falling Limits Constraints
 */
const stockSchema = new mongoose.Schema({
  stockId: { type: String, required: true, unique: true, index: true },
  symbol: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  fallingLimit: { type: Number, required: true },
  risingLimit: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

export const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);
export default Stock;
