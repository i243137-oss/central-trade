import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'CTS_SYSTEM_CONFIG' },
  operationsSuspended: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export const SystemConfig = mongoose.models.SystemConfig || mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
