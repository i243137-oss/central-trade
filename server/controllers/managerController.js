import dbManager from '../services/database/ManagementOfDatabase.js';
import instructionManager from '../services/instruction/ManagementOfInstruction.js';
import { seedDatabase } from '../seed/seedData.js';

export async function getSystemOverview(req, res) {
  try {
    const users = await dbManager.getAllUsers();
    const accounts = await dbManager.getAllAccounts();
    const stocks = await dbManager.getAllStocks();
    const instructions = await dbManager.getAllInstructions();
    const trades = await dbManager.getAllTrades();
    const logs = await dbManager.getLogs(50);
    const operationsSuspended = dbManager.isOperationsSuspended();

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers: users.length,
          totalAccounts: accounts.length,
          totalStocks: stocks.length,
          totalInstructions: instructions.length,
          pendingInstructions: instructions.filter(i => i.status === 'PENDING').length,
          partiallyFinishedInstructions: instructions.filter(i => i.status === 'PARTIALLY_FINISHED').length,
          totallyFinishedInstructions: instructions.filter(i => i.status === 'TOTALLY_FINISHED').length,
          cancelledInstructions: instructions.filter(i => i.status === 'CANCELLED').length,
          expiredInstructions: instructions.filter(i => i.status === 'EXPIRED').length,
          totalTrades: trades.length,
          operationsSuspended
        },
        users,
        accounts,
        stocks,
        instructions: instructions.slice(-100).reverse(),
        trades: trades.slice(-100).reverse(),
        logs
      }
    });
  } catch (err) {
    console.error('[managerController.getSystemOverview] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching manager overview.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function toggleSuspension(req, res) {
  try {
    const { suspended } = req.body;
    const currentState = dbManager.isOperationsSuspended();
    const newState = suspended !== undefined ? !!suspended : !currentState;

    dbManager.setOperationsSuspended(newState);

    await dbManager.insertLog('SYSTEM_SUSPENSION_TOGGLED', {
      operationsSuspended: newState,
      managerId: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: `Trading system operations have been ${newState ? 'SUSPENDED' : 'RESUMED'}.`,
      data: {
        operationsSuspended: newState
      }
    });
  } catch (err) {
    console.error('[managerController.toggleSuspension] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating suspension state.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function triggerOutdatedSweep(req, res) {
  try {
    const { maxAgeHours } = req.body;
    // Default to 24 hours (SRS 7.2.4), or allow custom threshold for fast academic testing
    const hours = maxAgeHours !== undefined ? Number(maxAgeHours) : 24;

    const expired = await instructionManager.sweepOutdatedInstructions(hours);

    return res.status(200).json({
      success: true,
      message: `Outdated instruction sweep completed. ${expired.length} instruction(s) marked EXPIRED and removed from matching.`,
      data: {
        sweptCount: expired.length,
        thresholdHours: hours,
        expiredInstructions: expired
      }
    });
  } catch (err) {
    console.error('[managerController.triggerOutdatedSweep] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error sweeping outdated instructions.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function getSystemLogs(req, res) {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = await dbManager.getLogs(limit);
    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('[managerController.getSystemLogs] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching system logs.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function resetDatabaseData(req, res) {
  try {
    await seedDatabase(true);
    return res.status(200).json({
      success: true,
      message: 'CTS academic database reset and re-seeded successfully.'
    });
  } catch (err) {
    console.error('[managerController.resetDatabaseData] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error resetting database.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
