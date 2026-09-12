import { Router } from 'express';
import {
  getAllStocks,
  getStockById,
  createStock,
  updateStockLimits
} from '../controllers/stockController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Publicly readable for active clients
router.get('/', getAllStocks);
router.get('/:id', getStockById);

// Stock creation and limit modification (R04) restricted to SYSTEM_MANAGER (R10)
router.post('/', authenticateToken, requireRole('SYSTEM_MANAGER'), createStock);
router.patch('/:id/limits', authenticateToken, requireRole('SYSTEM_MANAGER'), updateStockLimits);

export default router;
