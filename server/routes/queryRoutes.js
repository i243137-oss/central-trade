import { Router } from 'express';
import { userQuery, stockQuery, getAllTrades } from '../controllers/queryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// SRS 7.1.1 (c) User Query Instruction
router.get('/user', userQuery);

// SRS 7.1.1 (c) Stock Query Instruction
router.get('/stock', stockQuery);

// General trade history query
router.get('/trades', getAllTrades);

export default router;
