import dbManager from '../database/ManagementOfDatabase.js';

/**
 * PretreatmentOfInstruction
 * Corresponds directly to SRS Section 6 (CRC Index Cards, page 15) and DFD 3.3 (page 11)
 *
 * Responsibilities:
 * 1. Legal analysis / Input validation (User ID, Stock ID, Quantity > 0, Price > 0, Timestamp)
 * 2. Determination of prices' increments and decrements constraints (Rising / Falling Limits - R04)
 * 3. Freeze account of buyers (R06)
 * 4. Log instruction
 * 5. Forward validated instruction to ManagementOfInstruction
 */
class PretreatmentOfInstruction {
  /**
   * Pre-treat and validate an instruction
   * @param {Object} rawInstruction - { userId, stockId, type, quantity, respectedPrice, timestamp }
   * @returns {Object} { isValid, error, errorCode, instruction, frozenAmount }
   */
  async process(rawInstruction) {
    const { userId, stockId, type, quantity, respectedPrice, timestamp } = rawInstruction;

    // 1. Basic Parameter Validation (SRS 7.1.1: user ID, stock ID, quantity, respected price, timestamp)
    if (!userId) {
      return { isValid: false, error: 'User ID is required', errorCode: 'MISSING_USER_ID' };
    }
    if (!stockId) {
      return { isValid: false, error: 'Stock ID is required', errorCode: 'MISSING_STOCK_ID' };
    }
    if (!type || (type !== 'BUY' && type !== 'SELL')) {
      return { isValid: false, error: 'Instruction type must be BUY or SELL', errorCode: 'INVALID_TYPE' };
    }
    const numQty = Number(quantity);
    if (!Number.isInteger(numQty) || numQty <= 0) {
      return { isValid: false, error: 'Quantity must be a positive integer', errorCode: 'INVALID_QUANTITY' };
    }
    const numPrice = Number(respectedPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      return { isValid: false, error: 'Respected price must be a positive number', errorCode: 'INVALID_PRICE' };
    }

    const instructionTime = timestamp || new Date().toISOString();

    // 2. Validate Stock & Rising/Falling Limit (SRS 7.2.2 & CRC Card)
    const stock = await dbManager.findStockById(stockId);
    if (!stock) {
      await dbManager.insertLog('INSTRUCTION_REJECTED', {
        reason: 'UNKNOWN_STOCK',
        stockId,
        userId
      });
      return { isValid: false, error: `Stock '${stockId}' is not registered in CTS`, errorCode: 'STOCK_NOT_FOUND' };
    }

    // Check Rising Limit (R04)
    if (numPrice > stock.risingLimit) {
      const msg = `Trading instruction rejected: Price ($${numPrice.toFixed(2)}) exceeds the rising limit ($${stock.risingLimit.toFixed(2)}).`;
      await dbManager.insertLog('INSTRUCTION_REJECTED', {
        reason: 'RISING_LIMIT_EXCEEDED',
        userId,
        stockId,
        price: numPrice,
        limit: stock.risingLimit
      });
      return { isValid: false, error: msg, errorCode: 'RISING_LIMIT_EXCEEDED' };
    }

    // Check Falling Limit (R04)
    if (numPrice < stock.fallingLimit) {
      const msg = `Trading instruction rejected: Price ($${numPrice.toFixed(2)}) is below the falling limit ($${stock.fallingLimit.toFixed(2)}).`;
      await dbManager.insertLog('INSTRUCTION_REJECTED', {
        reason: 'FALLING_LIMIT_EXCEEDED',
        userId,
        stockId,
        price: numPrice,
        limit: stock.fallingLimit
      });
      return { isValid: false, error: msg, errorCode: 'FALLING_LIMIT_EXCEEDED' };
    }

    // 3. Fund Freezing for BUY instructions (SRS 7.2 & CRC Card)
    let frozenAmount = 0;
    if (type === 'BUY') {
      const requiredFunds = Math.round(numQty * numPrice * 100) / 100;
      // Execute atomic fund check and freeze under mutex
      try {
        await dbManager.freezeFunds(userId, requiredFunds);
        frozenAmount = requiredFunds;
      } catch (err) {
        await dbManager.insertLog('INSTRUCTION_REJECTED', {
          reason: 'INSUFFICIENT_FUNDS',
          userId,
          requiredFunds,
          error: err.message
        });
        return { isValid: false, error: err.message, errorCode: 'INSUFFICIENT_FUNDS' };
      }
    }

    // 4. Log validated instruction
    await dbManager.insertLog('INSTRUCTION_PRETREATED', {
      userId,
      stockId,
      type,
      quantity: numQty,
      respectedPrice: numPrice,
      frozenAmount
    });

    return {
      isValid: true,
      instruction: {
        userId,
        stockId: stock.stockId,
        type,
        quantity: numQty,
        remainingQuantity: numQty,
        respectedPrice: numPrice,
        timestamp: instructionTime,
        status: 'PENDING',
        frozenAmount
      },
      frozenAmount
    };
  }
}

export const pretreatmentService = new PretreatmentOfInstruction();
export default pretreatmentService;
