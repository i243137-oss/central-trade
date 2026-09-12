import { Router } from 'express';
import {
  createInstruction,
  cancelInstruction,
  getInstructions,
  getInstructionById
} from '../controllers/instructionController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All instruction endpoints require authenticated session
router.use(authenticateToken);

router.post('/', createInstruction);
router.get('/', getInstructions);
router.get('/:id', getInstructionById);
router.patch('/:id/cancel', cancelInstruction);

export default router;
