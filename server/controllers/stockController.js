import dbManager from '../services/database/ManagementOfDatabase.js';

export async function getAllStocks(req, res) {
  try {
    const stocks = await dbManager.getAllStocks();
    return res.status(200).json({
      success: true,
      data: stocks
    });
  } catch (err) {
    console.error('[stockController.getAllStocks] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching stocks.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function getStockById(req, res) {
  try {
    const { id } = req.params;
    const stock = await dbManager.findStockById(id.toUpperCase());
    if (!stock) {
      return res.status(404).json({
        success: false,
        message: `Stock '${id}' not found.`,
        errorCode: 'STOCK_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: stock
    });
  } catch (err) {
    console.error('[stockController.getStockById] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching stock.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function createStock(req, res) {
  try {
    const { stockId, symbol, name, fallingLimit, risingLimit } = req.body;

    if (!symbol || !name || fallingLimit === undefined || risingLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Symbol, name, fallingLimit, and risingLimit are required.',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const fall = Number(fallingLimit);
    const rise = Number(risingLimit);
    if (isNaN(fall) || isNaN(rise) || fall < 0 || rise <= fall) {
      return res.status(400).json({
        success: false,
        message: 'Falling limit must be positive and strictly less than rising limit.',
        errorCode: 'INVALID_LIMITS'
      });
    }

    const newStock = await dbManager.insertStock({
      stockId: (stockId || symbol).toUpperCase(),
      symbol: symbol.toUpperCase(),
      name: name.trim(),
      fallingLimit: fall,
      risingLimit: rise
    });

    await dbManager.insertLog('STOCK_CREATED', {
      symbol: newStock.symbol,
      fallingLimit: fall,
      risingLimit: rise,
      managerId: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Stock created successfully.',
      data: newStock
    });
  } catch (err) {
    console.error('[stockController.createStock] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error creating stock.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function updateStockLimits(req, res) {
  try {
    const { id } = req.params;
    const { fallingLimit, risingLimit } = req.body;

    const fall = Number(fallingLimit);
    const rise = Number(risingLimit);
    if (isNaN(fall) || isNaN(rise) || fall < 0 || rise <= fall) {
      return res.status(400).json({
        success: false,
        message: 'Falling limit must be positive and strictly less than rising limit.',
        errorCode: 'INVALID_LIMITS'
      });
    }

    const updated = await dbManager.updateStockLimits(id.toUpperCase(), {
      fallingLimit: fall,
      risingLimit: rise
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Stock '${id}' not found.`,
        errorCode: 'STOCK_NOT_FOUND'
      });
    }

    await dbManager.insertLog('STOCK_LIMITS_UPDATED', {
      stockId: updated.stockId,
      fallingLimit: fall,
      risingLimit: rise,
      managerId: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: `Price limits for ${updated.stockId} updated successfully.`,
      data: updated
    });
  } catch (err) {
    console.error('[stockController.updateStockLimits] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating stock limits.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
