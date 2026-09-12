import dbManager from '../services/database/ManagementOfDatabase.js';

/**
 * Query Trade Information Controller
 * Implements SRS 7.1.1 (c), SRS 7.1.2, SRS 7.1.3 & R07
 *
 * Requirements:
 * 1. User query instruction: user ID, query content, restrict parameters
 * 2. Stock query instruction: stock ID, query content, restrict parameters
 * 3. Structuralize queried data
 * 4. Graceful handling of invalid query / no matching data
 */

export async function userQuery(req, res) {
  try {
    const { userId, queryContent, restrictParameters } = req.query;

    const targetUserId = userId || req.user.id;
    const isManager = req.user.role === 'SYSTEM_MANAGER';

    // Authorization: User can only query their own data unless manager
    if (!isManager && targetUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are only authorized to query your own trading information.',
        errorCode: 'UNAUTHORIZED_QUERY'
      });
    }

    const content = (queryContent || 'ALL').toUpperCase();
    let restricts = {};
    if (restrictParameters) {
      try {
        restricts = typeof restrictParameters === 'string'
          ? JSON.parse(restrictParameters)
          : restrictParameters;
      } catch {
        restricts = {};
      }
    }

    const result = {
      queryType: 'USER_QUERY',
      userId: targetUserId,
      queryContent: content,
      restrictParameters: restricts,
      timestamp: new Date().toISOString(),
      data: {}
    };

    let hasMatches = false;

    // Fetch account info
    if (content === 'ALL' || content === 'ACCOUNT' || content === 'BALANCE') {
      const account = await dbManager.findAccountByUserId(targetUserId);
      result.data.account = account || null;
      if (account) hasMatches = true;
    }

    // Fetch user instructions
    if (content === 'ALL' || content === 'INSTRUCTIONS' || content === 'ORDERS') {
      let instructions = await dbManager.getInstructionsByUserId(targetUserId);

      if (restricts.stockId) {
        instructions = instructions.filter(i => i.stockId.toUpperCase() === restricts.stockId.toUpperCase());
      }
      if (restricts.type) {
        instructions = instructions.filter(i => i.type === restricts.type);
      }
      if (restricts.status) {
        instructions = instructions.filter(i => i.status === restricts.status);
      }

      instructions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      result.data.instructions = instructions;
      if (instructions.length > 0) hasMatches = true;
    }

    // Fetch user trades
    if (content === 'ALL' || content === 'TRADES') {
      let trades = await dbManager.getTradesByUserId(targetUserId);
      if (restricts.stockId) {
        trades = trades.filter(t => t.stockId.toUpperCase() === restricts.stockId.toUpperCase());
      }
      trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      result.data.trades = trades;
      if (trades.length > 0) hasMatches = true;
    }

    if (!hasMatches) {
      return res.status(200).json({
        success: true,
        message: 'No matching trade information found.',
        data: result
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Trade information retrieved successfully.',
      data: result
    });
  } catch (err) {
    console.error('[queryController.userQuery] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Invalid query parameters or query processing failure.',
      errorCode: 'INVALID_QUERY'
    });
  }
}

export async function stockQuery(req, res) {
  try {
    const { stockId, queryContent, restrictParameters } = req.query;

    if (!stockId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query: stockId parameter is required for stock query instruction.',
        errorCode: 'MISSING_STOCK_ID'
      });
    }

    const symbol = stockId.trim().toUpperCase();
    const stock = await dbManager.findStockById(symbol);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: `No matching trade information found: Stock '${symbol}' does not exist in CTS.`,
        errorCode: 'STOCK_NOT_FOUND'
      });
    }

    const content = (queryContent || 'ALL').toUpperCase();
    let restricts = {};
    if (restrictParameters) {
      try {
        restricts = typeof restrictParameters === 'string'
          ? JSON.parse(restrictParameters)
          : restrictParameters;
      } catch {
        restricts = {};
      }
    }

    const result = {
      queryType: 'STOCK_QUERY',
      stockId: symbol,
      stockInfo: stock,
      queryContent: content,
      restrictParameters: restricts,
      timestamp: new Date().toISOString(),
      data: {}
    };

    let hasMatches = true;

    // Information Releasing Module interface: stock price & limits (SRS 7.1.2)
    if (content === 'ALL' || content === 'PRICE' || content === 'LIMITS') {
      const allTrades = await dbManager.getTradesByStockId(symbol);
      const latestTrade = allTrades.length > 0 ? allTrades[allTrades.length - 1] : null;
      result.data.pricing = {
        symbol: stock.symbol,
        name: stock.name,
        fallingLimit: stock.fallingLimit,
        risingLimit: stock.risingLimit,
        latestPrice: latestTrade ? latestTrade.price : (stock.fallingLimit + stock.risingLimit) / 2,
        totalTrades: allTrades.length
      };
    }

    // Trade History for stock
    if (content === 'ALL' || content === 'TRADES') {
      let trades = await dbManager.getTradesByStockId(symbol);
      trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (restricts.limit) {
        trades = trades.slice(0, Number(restricts.limit));
      }
      result.data.trades = trades;
    }

    // Active Instructions / Order book for stock
    if (content === 'ALL' || content === 'INSTRUCTIONS' || content === 'ORDERS') {
      const allInstructions = await dbManager.getInstructionsByStockId(symbol);
      const active = allInstructions.filter(i =>
        (i.status === 'PENDING' || i.status === 'PARTIALLY_FINISHED') && i.remainingQuantity > 0
      );
      result.data.activeOrders = active;
    }

    return res.status(200).json({
      success: true,
      message: 'Stock trade information retrieved successfully.',
      data: result
    });
  } catch (err) {
    console.error('[queryController.stockQuery] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Invalid query parameters or query processing failure.',
      errorCode: 'INVALID_QUERY'
    });
  }
}

export async function getAllTrades(req, res) {
  try {
    const { stockId } = req.query;
    let trades = await dbManager.getAllTrades();

    if (stockId) {
      trades = trades.filter(t => t.stockId.toUpperCase() === stockId.toUpperCase());
    }

    trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      success: true,
      data: trades
    });
  } catch (err) {
    console.error('[queryController.getAllTrades] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching trades.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
