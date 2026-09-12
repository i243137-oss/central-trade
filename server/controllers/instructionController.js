import instructionManager from '../services/instruction/ManagementOfInstruction.js';
import dbManager from '../services/database/ManagementOfDatabase.js';

export async function createInstruction(req, res) {
  try {
    const { stockId, type, quantity, respectedPrice, timestamp } = req.body;

    // Build raw instruction according to SRS 7.1.1: user ID, stock ID, quantity, respected price, timestamp
    const rawInstruction = {
      userId: req.user.id,
      stockId: stockId ? stockId.trim().toUpperCase() : '',
      type,
      quantity: Number(quantity),
      respectedPrice: Number(respectedPrice),
      // Optional timestamp override enables R05 academic testing without manipulating system clock
      timestamp: timestamp || new Date().toISOString()
    };

    const result = await instructionManager.addInstruction(rawInstruction);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: result.errorCode
      });
    }

    // Refresh caller's account
    const account = await dbManager.findAccountByUserId(req.user.id);

    return res.status(201).json({
      success: true,
      message: result.message,
      data: {
        instruction: result.instruction,
        executedTrades: result.executedTrades,
        account
      }
    });
  } catch (err) {
    console.error('[instructionController.createInstruction] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing instruction.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function cancelInstruction(req, res) {
  try {
    const { id } = req.params;
    const isManager = req.user.role === 'SYSTEM_MANAGER';

    const result = await instructionManager.cancelInstruction(id, req.user.id, isManager);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        errorCode: result.errorCode
      });
    }

    const account = await dbManager.findAccountByUserId(req.user.id);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        instruction: result.instruction,
        releasedFunds: result.releasedFunds,
        account
      }
    });
  } catch (err) {
    console.error('[instructionController.cancelInstruction] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while cancelling instruction.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function getInstructions(req, res) {
  try {
    const { stockId, type, status, all } = req.query;
    const isManager = req.user.role === 'SYSTEM_MANAGER';

    let filter = {};
    // If ordinary user, always restrict to their own instructions
    if (!isManager || all !== 'true') {
      filter.userId = req.user.id;
    }
    if (stockId) filter.stockId = stockId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const instructions = await instructionManager.searchInstructions(filter);

    // Return in reverse chronological order
    instructions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      success: true,
      data: instructions
    });
  } catch (err) {
    console.error('[instructionController.getInstructions] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching instructions.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function getInstructionById(req, res) {
  try {
    const { id } = req.params;
    const instruction = await dbManager.findInstructionById(id);

    if (!instruction) {
      return res.status(404).json({
        success: false,
        message: `Instruction with ID '${id}' not found.`,
        errorCode: 'NOT_FOUND'
      });
    }

    // Check authorization: must own instruction or be manager
    if (req.user.role !== 'SYSTEM_MANAGER' && instruction.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this instruction.',
        errorCode: 'FORBIDDEN'
      });
    }

    return res.status(200).json({
      success: true,
      data: instruction
    });
  } catch (err) {
    console.error('[instructionController.getInstructionById] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching instruction.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
