import dbManager from '../services/database/ManagementOfDatabase.js';

export async function getMyAccount(req, res) {
  try {
    const account = await dbManager.findAccountByUserId(req.user.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Security account not found.',
        errorCode: 'ACCOUNT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: account
    });
  } catch (err) {
    console.error('[accountController.getMyAccount] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching security account.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function depositFunds(req, res) {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Deposit amount must be a positive number.',
        errorCode: 'INVALID_AMOUNT'
      });
    }

    const account = await dbManager.findAccountByUserId(req.user.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Security account not found.',
        errorCode: 'ACCOUNT_NOT_FOUND'
      });
    }

    const updated = await dbManager.updateAccount(req.user.id, {
      totalBalance: account.totalBalance + numAmount,
      availableBalance: account.availableBalance + numAmount
    });

    await dbManager.insertLog('FUNDS_DEPOSITED', {
      userId: req.user.id,
      amount: numAmount,
      newTotal: updated.totalBalance
    });

    return res.status(200).json({
      success: true,
      message: `$${numAmount.toFixed(2)} deposited successfully.`,
      data: updated
    });
  } catch (err) {
    console.error('[accountController.depositFunds] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error processing deposit.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
