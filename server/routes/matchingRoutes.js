import { Router } from 'express';
import { runMatching, getOrderBook } from '../controllers/matchingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Order book is readable by logged-in users and managers
router.get('/order-book/:stockId?', authenticateToken, getOrderBook);

// Run matching can be triggered by users/managers to test SRS price-time priority
router.post('/run', authenticateToken, runMatching);

export default router;
