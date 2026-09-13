import { Router } from 'express';
import {
  getSystemOverview,
  toggleSuspension,
  triggerOutdatedSweep,
  getSystemLogs,
  resetDatabaseData,
  setAccountBalance
} from '../controllers/managerController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Strict authorization: all endpoints under /api/manager require SYSTEM_MANAGER (R10)
router.use(authenticateToken);
router.use(requireRole('SYSTEM_MANAGER'));

router.get('/overview', getSystemOverview);
router.post('/suspend', toggleSuspension);
router.post('/outdated-sweep', triggerOutdatedSweep);
router.get('/logs', getSystemLogs);
router.post('/reset', resetDatabaseData);
router.post('/set-balance', setAccountBalance);

export default router;
