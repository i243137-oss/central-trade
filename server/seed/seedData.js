import bcrypt from 'bcryptjs';
import dbManager from '../services/database/ManagementOfDatabase.js';

export async function seedDatabase(forceReset = false) {
  if (forceReset) {
    await dbManager.clearAllCollections();
  } else {
    const existingUsers = await dbManager.getAllUsers();
    if (existingUsers && existingUsers.length > 0) return;
  }

  console.log('[CTS Seed] Seeding academic demonstration data to MongoDB...');
  const salt = await bcrypt.genSalt(10);
  const managerHash = await bcrypt.hash('admin123', salt);
  const userHash = await bcrypt.hash('user123', salt);

  const mgr = await dbManager.insertUser({
    id: 'USR-MGR-001', name: 'System Manager', email: 'manager@example.com',
    passwordHash: managerHash, role: 'SYSTEM_MANAGER',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  });
  const u1 = await dbManager.insertUser({
    id: 'USR-NORM-001', name: 'Alice Trader', email: 'user@example.com',
    passwordHash: userHash, role: 'USER',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  });
  const u2 = await dbManager.insertUser({
    id: 'USR-NORM-002', name: 'Bob Investor', email: 'trader2@example.com',
    passwordHash: userHash, role: 'USER',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  await dbManager.insertAccount({ id: 'ACC-MGR-001', userId: mgr.id, totalBalance: 100000, availableBalance: 100000, frozenBalance: 0 });
  await dbManager.insertAccount({ id: 'ACC-NORM-001', userId: u1.id, totalBalance: 50000, availableBalance: 42000, frozenBalance: 8000 });
  await dbManager.insertAccount({ id: 'ACC-NORM-002', userId: u2.id, totalBalance: 50000, availableBalance: 50000, frozenBalance: 0 });

  const stocks = [
    { stockId: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', fallingLimit: 95, risingLimit: 105 },
    { stockId: 'MSFT', symbol: 'MSFT', name: 'Microsoft Corp.', fallingLimit: 200, risingLimit: 230 },
    { stockId: 'GOOG', symbol: 'GOOG', name: 'Alphabet Inc.', fallingLimit: 140, risingLimit: 165 },
    { stockId: 'TSLA', symbol: 'TSLA', name: 'Tesla Inc.', fallingLimit: 180, risingLimit: 220 }
  ];
  for (const s of stocks) await dbManager.insertStock(s);

  const now = Date.now();
  await dbManager.insertInstruction({ id: 'INST-DEMO-001', userId: u1.id, stockId: 'AAPL', type: 'BUY', quantity: 50, remainingQuantity: 50, respectedPrice: 100, timestamp: new Date(now - 30*60*1000).toISOString(), status: 'PENDING', frozenAmount: 5000 });
  await dbManager.insertInstruction({ id: 'INST-DEMO-002', userId: u1.id, stockId: 'AAPL', type: 'BUY', quantity: 30, remainingQuantity: 30, respectedPrice: 100, timestamp: new Date(now - 15*60*1000).toISOString(), status: 'PENDING', frozenAmount: 3000 });
  await dbManager.insertInstruction({ id: 'INST-DEMO-003', userId: u2.id, stockId: 'AAPL', type: 'SELL', quantity: 40, remainingQuantity: 40, respectedPrice: 102, timestamp: new Date(now - 20*60*1000).toISOString(), status: 'PENDING', frozenAmount: 0 });
  await dbManager.insertInstruction({ id: 'INST-OUTDATED-004', userId: u2.id, stockId: 'MSFT', type: 'BUY', quantity: 10, remainingQuantity: 10, respectedPrice: 205, timestamp: new Date(now - 36*60*60*1000).toISOString(), status: 'PENDING', frozenAmount: 2050 });
  await dbManager.insertInstruction({ id: 'INST-HIST-005', userId: u1.id, stockId: 'GOOG', type: 'BUY', quantity: 20, remainingQuantity: 0, respectedPrice: 150, timestamp: new Date(now - 2*60*60*1000).toISOString(), status: 'TOTALLY_FINISHED', frozenAmount: 3000 });
  await dbManager.insertInstruction({ id: 'INST-HIST-006', userId: u2.id, stockId: 'GOOG', type: 'SELL', quantity: 20, remainingQuantity: 0, respectedPrice: 150, timestamp: new Date(now - 2*60*60*1000).toISOString(), status: 'TOTALLY_FINISHED', frozenAmount: 0 });
  await dbManager.insertTrade({ id: 'TRD-HIST-001', buyInstructionId: 'INST-HIST-005', sellInstructionId: 'INST-HIST-006', buyerUserId: u1.id, sellerUserId: u2.id, stockId: 'GOOG', quantity: 20, price: 150, timestamp: new Date(now - 2*60*60*1000).toISOString() });

  await dbManager.setOperationsSuspended(false);
  await dbManager.insertLog('SYSTEM_SEEDED', { usersSeeded: 3, stocksSeeded: stocks.length, instructionsSeeded: 6 });
  console.log('[CTS Seed] Seed complete: Manager (manager@example.com), Normal (user@example.com), Stocks AAPL, MSFT, GOOG, TSLA.');
}
