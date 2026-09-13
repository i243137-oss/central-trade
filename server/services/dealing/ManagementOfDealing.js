import dbManager from '../database/ManagementOfDatabase.js';

/**
 * ManagementOfDealing
 * Corresponds directly to SRS Section 6 (CRC Index Cards, pages 15-16) and Section 7.2.1 (Function Criteria)
 *
 * Responsibilities:
 * 1. Price-First Principle:
 *    - BUY orders sorted descending by respectedPrice (higher price has priority)
 *    - SELL orders sorted ascending by respectedPrice (lower price has priority)
 * 2. Time-First Principle:
 *    - Equal price orders sorted ascending by timestamp (earlier instruction has priority)
 * 3. Execution Rule:
 *    - A match occurs when buy.respectedPrice >= sell.respectedPrice
 *    - (SRS 7.2.1: "If the lowest buy price is higher than the highest sell price, then the CTS will make a match")
 * 4. Quantity Fulfillment & State Transition:
 *    - Match executed quantity = min(buy.remainingQuantity, sell.remainingQuantity)
 *    - Order remaining quantity decremented
 *    - Status transitions:
 *      - remaining === 0 -> 'TOTALLY_FINISHED'
 *      - remaining > 0 -> 'PARTIALLY_FINISHED'
 * 5. Settlement & Fund adjustment (R06):
 *    - Executes trade via ManagementOfDatabase
 * 6. Logs the business results to CTS audit trail
 */
class ManagementOfDealing {
  /**
   * Sort buy instructions by Price-First (descending), then Time-First (ascending)
   */
  sortBuyInstructions(instructions) {
    return [...instructions].sort((a, b) => {
      // Higher price first
      if (b.respectedPrice !== a.respectedPrice) {
        return b.respectedPrice - a.respectedPrice;
      }
      // Earlier timestamp first
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Sort sell instructions by Price-First (ascending), then Time-First (ascending)
   */
  sortSellInstructions(instructions) {
    return [...instructions].sort((a, b) => {
      // Lower price first
      if (a.respectedPrice !== b.respectedPrice) {
        return a.respectedPrice - b.respectedPrice;
      }
      // Earlier timestamp first
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Run matching algorithm for a specific stock (or all stocks)
   * @param {string} [stockId] - Optional stockId filter
   * @returns {Promise<Array>} Array of executed trades
   */
  async matchInstructions(stockId = null) {
    // Check if operations are suspended (SRS Exception)
    if (await dbManager.isOperationsSuspended()) {
      throw new Error('Operations suspended: All trading operations are currently suspended by Trading Management System.');
    }

    const allInstructions = await dbManager.getAllInstructions();
    const stocksToProcess = stockId
      ? [stockId]
      : [...new Set(allInstructions.map(i => i.stockId))];

    const executedTrades = [];

    for (const currentStock of stocksToProcess) {
      // Get all active matching candidates: PENDING or PARTIALLY_FINISHED with remainingQuantity > 0
      const activeInstructions = allInstructions.filter(i =>
        i.stockId === currentStock &&
        (i.status === 'PENDING' || i.status === 'PARTIALLY_FINISHED') &&
        i.remainingQuantity > 0
      );

      let buyOrders = this.sortBuyInstructions(
        activeInstructions.filter(i => i.type === 'BUY')
      );
      let sellOrders = this.sortSellInstructions(
        activeInstructions.filter(i => i.type === 'SELL')
      );

      let buyIndex = 0;
      let sellIndex = 0;

      while (buyIndex < buyOrders.length && sellIndex < sellOrders.length) {
        const bestBuy = buyOrders[buyIndex];
        const bestSell = sellOrders[sellIndex];

        // SRS 7.2.1: Price principle - lowest buy price must be >= highest sell price (or buy price >= sell price)
        if (bestBuy.respectedPrice >= bestSell.respectedPrice) {
          // Determine execution price: In standard exchanges, the earlier order sets the price.
          // If buy was entered earlier, buy price; if sell was entered earlier, sell price.
          // If identical timestamp, sell price.
          const buyTime = new Date(bestBuy.timestamp).getTime();
          const sellTime = new Date(bestSell.timestamp).getTime();
          const executionPrice = buyTime <= sellTime ? bestBuy.respectedPrice : bestSell.respectedPrice;

          // Determine executed trade quantity
          const tradeQuantity = Math.min(bestBuy.remainingQuantity, bestSell.remainingQuantity);
          const tradeTimestamp = new Date().toISOString();

          // Calculate monetary values
          const executionTotal = tradeQuantity * executionPrice;
          const buyerRespectedUnit = bestBuy.respectedPrice;
          const buyerRespectedTotal = tradeQuantity * buyerRespectedUnit;

          // Record Trade
          const tradeRecord = await dbManager.insertTrade({
            buyInstructionId: bestBuy.id,
            sellInstructionId: bestSell.id,
            buyerUserId: bestBuy.userId,
            sellerUserId: bestSell.userId,
            stockId: currentStock,
            quantity: tradeQuantity,
            price: executionPrice,
            timestamp: tradeTimestamp
          });

          // Update buyer instruction
          bestBuy.remainingQuantity -= tradeQuantity;
          const buyerNewStatus = bestBuy.remainingQuantity === 0 ? 'TOTALLY_FINISHED' : 'PARTIALLY_FINISHED';
          await dbManager.updateInstruction(bestBuy.id, {
            remainingQuantity: bestBuy.remainingQuantity,
            status: buyerNewStatus
          });

          // Update seller instruction
          bestSell.remainingQuantity -= tradeQuantity;
          const sellerNewStatus = bestSell.remainingQuantity === 0 ? 'TOTALLY_FINISHED' : 'PARTIALLY_FINISHED';
          await dbManager.updateInstruction(bestSell.id, {
            remainingQuantity: bestSell.remainingQuantity,
            status: sellerNewStatus
          });

          // Settle Security Account balances (R06 Fund Freezing and settlement)
          await dbManager.settleTradeFunds(
            bestBuy.userId,
            bestSell.userId,
            executionTotal,
            buyerRespectedTotal
          );

          // Log execution (SRS CRC Card: Log results of business)
          await dbManager.insertLog('TRADE_EXECUTED', {
            tradeId: tradeRecord.id,
            stockId: currentStock,
            buyInstructionId: bestBuy.id,
            sellInstructionId: bestSell.id,
            quantity: tradeQuantity,
            price: executionPrice,
            buyerStatus: buyerNewStatus,
            sellerStatus: sellerNewStatus
          });

          executedTrades.push(tradeRecord);

          // Advance indices if orders are completely fulfilled
          if (bestBuy.remainingQuantity === 0) {
            buyIndex++;
          }
          if (bestSell.remainingQuantity === 0) {
            sellIndex++;
          }
        } else {
          // No price overlap possible between highest remaining buy and lowest remaining sell
          break;
        }
      }
    }

    return executedTrades;
  }
}

export const dealingManager = new ManagementOfDealing();
export default dealingManager;
