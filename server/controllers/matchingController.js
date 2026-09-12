import dealingManager from '../services/dealing/ManagementOfDealing.js';
import dbManager from '../services/database/ManagementOfDatabase.js';

export async function runMatching(req, res) {
  try {
    const { stockId } = req.body;

    const executedTrades = await dealingManager.matchInstructions(stockId || null);

    return res.status(200).json({
      success: true,
      message: `Matching engine executed. ${executedTrades.length} trade(s) completed.`,
      data: {
        tradesCount: executedTrades.length,
        trades: executedTrades
      }
    });
  } catch (err) {
    console.error('[matchingController.runMatching] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Error executing matching engine.',
      errorCode: 'MATCHING_ERROR'
    });
  }
}

export async function getOrderBook(req, res) {
  try {
    const { stockId } = req.params;
    const targetStock = stockId ? stockId.toUpperCase() : null;

    const all = await dbManager.getAllInstructions();
    const active = all.filter(i =>
      (!targetStock || i.stockId === targetStock) &&
      (i.status === 'PENDING' || i.status === 'PARTIALLY_FINISHED') &&
      i.remainingQuantity > 0
    );

    const buyOrders = dealingManager.sortBuyInstructions(
      active.filter(i => i.type === 'BUY')
    );
    const sellOrders = dealingManager.sortSellInstructions(
      active.filter(i => i.type === 'SELL')
    );

    return res.status(200).json({
      success: true,
      data: {
        stockId: targetStock,
        buys: buyOrders,
        sells: sellOrders,
        totalBids: buyOrders.length,
        totalAsks: sellOrders.length
      }
    });
  } catch (err) {
    console.error('[matchingController.getOrderBook] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching order book.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
