import { Router } from 'express';
import { getMyAccount, depositFunds } from '../controllers/accountController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.get('/me', getMyAccount);
router.post('/deposit', depositFunds);

export default router;
