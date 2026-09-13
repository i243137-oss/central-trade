import dbManager from '../database/ManagementOfDatabase.js';
import pretreatmentService from '../pretreatment/PretreatmentOfInstruction.js';
import dealingManager from '../dealing/ManagementOfDealing.js';

/**
 * ManagementOfInstruction
 * Corresponds directly to SRS Section 6 (CRC Index Cards, page 15) and DFD 3.4 (page 12)
 *
 * Responsibilities:
 * 1. Add instructions (collaborates with Pretreatment and Dealing)
 * 2. Cancel instructions (SRS R02 with exception handling)
 * 3. Search & Sort instructions
 * 4. Sweep Outdated instructions (SRS R05: instructions older than 1 day marked EXPIRED)
 */
class ManagementOfInstruction {
  /**
   * Submit and add a new trading instruction (Buy / Sell)
   * Pipeline: Pretreatment -> Save Instruction -> Attempt Matching -> Return Result
   */
  async addInstruction(rawInstruction) {
    // Check if operations are suspended (SRS Exception)
    if (await dbManager.isOperationsSuspended()) {
      return {
        success: false,
        error: 'Operations suspended: All trading operations are currently suspended by Trading Management System.',
        errorCode: 'OPERATIONS_SUSPENDED'
      };
    }

    // Phase 1: Pretreatment of Instruction
    const pretreatmentResult = await pretreatmentService.process(rawInstruction);
    if (!pretreatmentResult.isValid) {
      return {
        success: false,
        error: pretreatmentResult.error,
        errorCode: pretreatmentResult.errorCode
      };
    }

    // Phase 2: Save instruction to CTS instruction store
    const savedInstruction = await dbManager.insertInstruction(pretreatmentResult.instruction);

    // Phase 3: Immediate matching attempt (SRS R01 & R03)
    let executedTrades = [];
    try {
      executedTrades = await dealingManager.matchInstructions(savedInstruction.stockId);
    } catch (err) {
      console.error('[ManagementOfInstruction] Matching error during addInstruction:', err);
    }

    // Phase 4: Fetch updated state of this instruction
    const updatedInstruction = await dbManager.findInstructionById(savedInstruction.id);

    return {
      success: true,
      message: `Instruction saved successfully. Status: ${updatedInstruction.status}`,
      instruction: updatedInstruction,
      executedTrades
    };
  }

  /**
   * Cancel an active instruction (SRS R02)
   * Handles SRS Exceptions:
   * 1. all the operations have been suspended
   * 2. the instruction concerned has been implemented (TOTALLY_FINISHED)
   * 3. no matched instruction to be cancelled
   */
  async cancelInstruction(instructionId, userId = null, isManager = false) {
    // Exception 1: Operations suspended
    if (await dbManager.isOperationsSuspended()) {
      return {
        success: false,
        error: 'Operations suspended: All trading operations are currently suspended by Trading Management System.',
        errorCode: 'OPERATIONS_SUSPENDED'
      };
    }

    // Exception 3: No matched instruction to be cancelled
    const instruction = await dbManager.findInstructionById(instructionId);
    if (!instruction) {
      return {
        success: false,
        error: `No matched instruction found with ID '${instructionId}'.`,
        errorCode: 'INSTRUCTION_NOT_FOUND'
      };
    }

    // Authorization check: User can only cancel their own order, unless manager
    if (!isManager && userId && instruction.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized: You can only cancel your own instructions.',
        errorCode: 'UNAUTHORIZED_CANCELLATION'
      };
    }

    // Exception 2: The instruction concerned has been implemented
    if (instruction.status === 'TOTALLY_FINISHED') {
      return {
        success: false,
        error: 'Instruction cannot be cancelled because it has already been implemented (totally finished).',
        errorCode: 'ALREADY_IMPLEMENTED'
      };
    }

    if (instruction.status === 'CANCELLED') {
      return {
        success: false,
        error: 'Instruction has already been cancelled.',
        errorCode: 'ALREADY_CANCELLED'
      };
    }

    if (instruction.status === 'EXPIRED') {
      return {
        success: false,
        error: 'Instruction has already expired and cannot be cancelled.',
        errorCode: 'ALREADY_EXPIRED'
      };
    }

    // Calculate unfulfilled quantity and frozen funds to release
    const cancelledQty = instruction.remainingQuantity;
    let releasedFunds = 0;

    if (instruction.type === 'BUY' && cancelledQty > 0) {
      releasedFunds = cancelledQty * instruction.respectedPrice;
      await dbManager.releaseFrozenFunds(instruction.userId, releasedFunds);
    }

    // Update status to CANCELLED and set remaining to 0
    const updated = await dbManager.updateInstruction(instruction.id, {
      status: 'CANCELLED',
      remainingQuantity: 0,
      cancelledAt: new Date().toISOString()
    });

    // Log cancellation
    await dbManager.insertLog('INSTRUCTION_CANCELLED', {
      instructionId: instruction.id,
      userId: instruction.userId,
      stockId: instruction.stockId,
      cancelledQuantity: cancelledQty,
      releasedFunds
    });

    return {
      success: true,
      message: `Instruction ${instruction.id} cancelled successfully.`,
      instruction: updated,
      releasedFunds
    };
  }

  /**
   * Search instructions by criteria
   */
  async searchInstructions(filters = {}) {
    let list = await dbManager.getAllInstructions();

    if (filters.userId) {
      list = list.filter(i => i.userId === filters.userId);
    }
    if (filters.stockId) {
      list = list.filter(i => i.stockId.toUpperCase() === filters.stockId.toUpperCase());
    }
    if (filters.type) {
      list = list.filter(i => i.type === filters.type);
    }
    if (filters.status) {
      list = list.filter(i => i.status === filters.status);
    }

    return list;
  }

  /**
   * Sweep outdated instructions (SRS R05: >= 1 day old)
   * Marks them 'EXPIRED', releases any remaining frozen funds, removes from matching queue
   * @param {number} [maxAgeHours=24] - Age in hours to qualify as outdated
   */
  async sweepOutdatedInstructions(maxAgeHours = 24) {
    const all = await dbManager.getAllInstructions();
    const now = Date.now();
    const thresholdMs = maxAgeHours * 60 * 60 * 1000;
    const expiredList = [];

    for (const inst of all) {
      // Only active instructions can expire
      if (inst.status === 'PENDING' || inst.status === 'PARTIALLY_FINISHED') {
        const instTime = new Date(inst.timestamp).getTime();
        const ageMs = now - instTime;

        if (ageMs >= thresholdMs) {
          // Release frozen funds if remaining BUY quantity
          if (inst.type === 'BUY' && inst.remainingQuantity > 0) {
            const releaseAmount = inst.remainingQuantity * inst.respectedPrice;
            await dbManager.releaseFrozenFunds(inst.userId, releaseAmount);
          }

          const updated = await dbManager.updateInstruction(inst.id, {
            status: 'EXPIRED',
            remainingQuantity: 0,
            expiredAt: new Date().toISOString()
          });

          await dbManager.insertLog('INSTRUCTION_EXPIRED', {
            instructionId: inst.id,
            userId: inst.userId,
            stockId: inst.stockId,
            ageHours: (ageMs / (1000 * 60 * 60)).toFixed(2)
          });

          expiredList.push(updated);
        }
      }
    }

    return expiredList;
  }
}

export const instructionManager = new ManagementOfInstruction();
export default instructionManager;
