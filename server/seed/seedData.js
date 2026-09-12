import bcrypt from 'bcryptjs';
import dbManager from '../services/database/ManagementOfDatabase.js';

export async function seedDatabase(forceReset = false) {
  if (forceReset) {
    dbManager.state = {
      users: [],
      accounts: [],
      stocks: [],
      instructions: [],
      trades: [],
      logs: [],
      systemConfig: {
        operationsSuspended: false
      }
    };
  } else if (dbManager.state.users && dbManager.state.users.length > 0) {
    // Already seeded
    return;
  }

  console.log('[CTS Seed] Seeding academic demonstration data...');

  // 1. Create Users
  const salt = await bcrypt.genSalt(10);
  const managerHash = await bcrypt.hash('admin123', salt);
  const userHash = await bcrypt.hash('user123', salt);

  const managerUser = await dbManager.insertUser({
    id: 'USR-MGR-001',
    name: 'System Manager',
    email: 'manager@example.com',
    passwordHash: managerHash,
    role: 'SYSTEM_MANAGER',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  });

  const normalUser1 = await dbManager.insertUser({
    id: 'USR-NORM-001',
    name: 'Alice Trader',
    email: 'user@example.com',
    passwordHash: userHash,
    role: 'USER',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  });

  const normalUser2 = await dbManager.insertUser({
    id: 'USR-NORM-002',
    name: 'Bob Investor',
    email: 'trader2@example.com',
    passwordHash: userHash,
    role: 'USER',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  });

  // 2. Create Security Accounts (R06)
  await dbManager.insertAccount({
    id: 'ACC-MGR-001',
    userId: managerUser.id,
    totalBalance: 100000.0,
    availableBalance: 100000.0,
    frozenBalance: 0
  });

  await dbManager.insertAccount({
    id: 'ACC-NORM-001',
    userId: normalUser1.id,
    totalBalance: 50000.0,
    availableBalance: 42000.0,
    frozenBalance: 8000.0 // 80 units @ 100 AAPL frozen
  });

  await dbManager.insertAccount({
    id: 'ACC-NORM-002',
    userId: normalUser2.id,
    totalBalance: 50000.0,
    availableBalance: 50000.0,
    frozenBalance: 0
  });

  // 3. Create Stocks with explicit academic rising and falling limits (R04)
  const stocks = [
    {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      fallingLimit: 95.0,
      risingLimit: 105.0
    },
    {
      stockId: 'MSFT',
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      fallingLimit: 200.0,
      risingLimit: 230.0
    },
    {
      stockId: 'GOOG',
      symbol: 'GOOG',
      name: 'Alphabet Inc.',
      fallingLimit: 140.0,
      risingLimit: 165.0
    },
    {
      stockId: 'TSLA',
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      fallingLimit: 180.0,
      risingLimit: 220.0
    }
  ];

  for (const s of stocks) {
    await dbManager.insertStock(s);
  }

  // 4. Create Sample Instructions to demonstrate R01, R03, R05
  const now = Date.now();

  // Instruction 1 (BUY AAPL - Time Priority 1: earlier timestamp)
  await dbManager.insertInstruction({
    id: 'INST-DEMO-001',
    userId: normalUser1.id,
    stockId: 'AAPL',
    type: 'BUY',
    quantity: 50,
    remainingQuantity: 50,
    respectedPrice: 100.0,
    timestamp: new Date(now - 30 * 60 * 1000).toISOString(), // 30 mins ago
    status: 'PENDING',
    frozenAmount: 5000.0
  });

  // Instruction 2 (BUY AAPL - Time Priority 2: same price 100.0, later timestamp)
  await dbManager.insertInstruction({
    id: 'INST-DEMO-002',
    userId: normalUser1.id,
    stockId: 'AAPL',
    type: 'BUY',
    quantity: 30,
    remainingQuantity: 30,
    respectedPrice: 100.0,
    timestamp: new Date(now - 15 * 60 * 1000).toISOString(), // 15 mins ago
    status: 'PENDING',
    frozenAmount: 3000.0
  });

  // Instruction 3 (SELL AAPL - waiting in order book at $102.00)
  await dbManager.insertInstruction({
    id: 'INST-DEMO-003',
    userId: normalUser2.id,
    stockId: 'AAPL',
    type: 'SELL',
    quantity: 40,
    remainingQuantity: 40,
    respectedPrice: 102.0,
    timestamp: new Date(now - 20 * 60 * 1000).toISOString(),
    status: 'PENDING',
    frozenAmount: 0
  });

  // Instruction 4 (Outdated Instruction - placed 36 hours ago, demonstrates R05 sweep)
  await dbManager.insertInstruction({
    id: 'INST-OUTDATED-004',
    userId: normalUser2.id,
    stockId: 'MSFT',
    type: 'BUY',
    quantity: 10,
    remainingQuantity: 10,
    respectedPrice: 205.0,
    timestamp: new Date(now - 36 * 60 * 60 * 1000).toISOString(), // 36 hours ago!
    status: 'PENDING',
    frozenAmount: 2050.0
  });

  // Instruction 5 & 6 + Trade Record (Historical Completed Trade)
  await dbManager.insertInstruction({
    id: 'INST-HIST-005',
    userId: normalUser1.id,
    stockId: 'GOOG',
    type: 'BUY',
    quantity: 20,
    remainingQuantity: 0,
    respectedPrice: 150.0,
    timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    status: 'TOTALLY_FINISHED',
    frozenAmount: 3000.0
  });

  await dbManager.insertInstruction({
    id: 'INST-HIST-006',
    userId: normalUser2.id,
    stockId: 'GOOG',
    type: 'SELL',
    quantity: 20,
    remainingQuantity: 0,
    respectedPrice: 150.0,
    timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    status: 'TOTALLY_FINISHED',
    frozenAmount: 0
  });

  await dbManager.insertTrade({
    id: 'TRD-HIST-001',
    buyInstructionId: 'INST-HIST-005',
    sellInstructionId: 'INST-HIST-006',
    buyerUserId: normalUser1.id,
    sellerUserId: normalUser2.id,
    stockId: 'GOOG',
    quantity: 20,
    price: 150.0,
    timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString()
  });

  await dbManager.insertLog('SYSTEM_SEEDED', {
    usersSeeded: 3,
    stocksSeeded: stocks.length,
    instructionsSeeded: 6
  });

  console.log('[CTS Seed] Seed complete: Manager (manager@example.com), Normal (user@example.com), Stocks AAPL, MSFT, GOOG, TSLA.');
}
