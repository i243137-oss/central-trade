import fs from 'fs';
import path from 'path';

/**
 * ManagementOfDatabase
 * Corresponds directly to SRS Section 6 (CRC Index Cards, page 16)
 * Responsibility: Support the basic operations interface of database for other modules
 * Supports Account operations, Stock operations, Instruction operations, Trade operations, User operations.
 */
class ManagementOfDatabase {
  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dbFile = path.resolve(this.dataDir, 'cts_database.json');
    this.state = {
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
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        this.state = JSON.parse(raw);
      } else {
        this.persist();
      }
    } catch (err) {
      console.error('[ManagementOfDatabase] Error initializing database store:', err);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[ManagementOfDatabase] Persistence error:', err);
    }
  }

  // --- USER OPERATIONS ---
  async findUserByEmail(email) {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(id) {
    return this.state.users.find(u => u.id === id || u._id === id) || null;
  }

  async getAllUsers() {
    return this.state.users.map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
  }

  async insertUser(user) {
    const id = user.id || `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id,
      _id: id,
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      role: user.role || 'USER',
      createdAt: user.createdAt || new Date().toISOString()
    };
    this.state.users.push(record);
    this.persist();
    return record;
  }

  // --- ACCOUNT OPERATIONS (R06 Fund Freezing) ---
  async findAccountByUserId(userId) {
    return this.state.accounts.find(a => a.userId === userId) || null;
  }

  async getAllAccounts() {
    return [...this.state.accounts];
  }

  async insertAccount(account) {
    const id = account.id || `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id,
      _id: id,
      userId: account.userId,
      totalBalance: Number(account.totalBalance || 0),
      availableBalance: Number(account.availableBalance || 0),
      frozenBalance: Number(account.frozenBalance || 0),
      updatedAt: new Date().toISOString()
    };
    this.state.accounts.push(record);
    this.persist();
    return record;
  }

  async updateAccount(userId, updateFields) {
    const account = this.state.accounts.find(a => a.userId === userId);
    if (!account) return null;

    if (updateFields.totalBalance !== undefined) {
      account.totalBalance = Number(updateFields.totalBalance);
    }
    if (updateFields.availableBalance !== undefined) {
      account.availableBalance = Number(updateFields.availableBalance);
    }
    if (updateFields.frozenBalance !== undefined) {
      account.frozenBalance = Number(updateFields.frozenBalance);
    }
    account.updatedAt = new Date().toISOString();
    this.persist();
    return account;
  }

  /**
   * Atomic balance freeze for BUY instruction
   */
  async freezeFunds(userId, amount) {
    const account = await this.findAccountByUserId(userId);
    if (!account) {
      throw new Error(`Account not found for user ${userId}`);
    }
    const reqAmount = Number(amount);
    if (account.availableBalance < reqAmount) {
      throw new Error(`Insufficient available balance ($${account.availableBalance.toFixed(2)}) for required amount ($${reqAmount.toFixed(2)})`);
    }

    account.availableBalance -= reqAmount;
    account.frozenBalance += reqAmount;
    account.updatedAt = new Date().toISOString();
    this.persist();
    return account;
  }

  /**
   * Release frozen funds (e.g. upon cancellation or expiration)
   */
  async releaseFrozenFunds(userId, amount) {
    const account = await this.findAccountByUserId(userId);
    if (!account) return null;
    const relAmount = Math.min(account.frozenBalance, Number(amount));
    account.frozenBalance -= relAmount;
    account.availableBalance += relAmount;
    account.updatedAt = new Date().toISOString();
    this.persist();
    return account;
  }

  /**
   * Settle trade funds:
   * Buyer: Deducts from frozenBalance and totalBalance
   * Seller: Adds to availableBalance and totalBalance
   */
  async settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount) {
    const buyerAccount = await this.findAccountByUserId(buyerUserId);
    const sellerAccount = await this.findAccountByUserId(sellerUserId);

    if (buyerAccount) {
      const exec = Number(executedAmount);
      const resp = Number(respectedAmount || executedAmount);
      
      // Remove actual cost from totalBalance
      buyerAccount.totalBalance -= exec;
      // Remove original frozen reservation from frozenBalance
      buyerAccount.frozenBalance -= resp;
      // Any price improvement refund (respected - executed) goes back to availableBalance
      const refund = resp - exec;
      if (refund > 0) {
        buyerAccount.availableBalance += refund;
      }
      buyerAccount.updatedAt = new Date().toISOString();
    }

    if (sellerAccount) {
      const exec = Number(executedAmount);
      sellerAccount.totalBalance += exec;
      sellerAccount.availableBalance += exec;
      sellerAccount.updatedAt = new Date().toISOString();
    }

    this.persist();
  }

  // --- STOCK OPERATIONS ---
  async getAllStocks() {
    return [...this.state.stocks];
  }

  async findStockById(stockId) {
    return this.state.stocks.find(s => s.stockId === stockId || s.symbol === stockId) || null;
  }

  async insertStock(stock) {
    const record = {
      stockId: stock.stockId || stock.symbol,
      symbol: stock.symbol,
      name: stock.name,
      fallingLimit: Number(stock.fallingLimit),
      risingLimit: Number(stock.risingLimit),
      createdAt: stock.createdAt || new Date().toISOString()
    };
    const existingIndex = this.state.stocks.findIndex(s => s.stockId === record.stockId);
    if (existingIndex >= 0) {
      this.state.stocks[existingIndex] = record;
    } else {
      this.state.stocks.push(record);
    }
    this.persist();
    return record;
  }

  async updateStockLimits(stockId, { fallingLimit, risingLimit }) {
    const stock = await this.findStockById(stockId);
    if (!stock) return null;
    if (fallingLimit !== undefined) stock.fallingLimit = Number(fallingLimit);
    if (risingLimit !== undefined) stock.risingLimit = Number(risingLimit);
    this.persist();
    return stock;
  }

  // --- INSTRUCTION OPERATIONS ---
  async insertInstruction(instruction) {
    const id = instruction.id || `INST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id,
      _id: id,
      userId: instruction.userId,
      stockId: instruction.stockId,
      type: instruction.type, // 'BUY' | 'SELL'
      quantity: Number(instruction.quantity),
      remainingQuantity: Number(instruction.remainingQuantity !== undefined ? instruction.remainingQuantity : instruction.quantity),
      respectedPrice: Number(instruction.respectedPrice),
      timestamp: instruction.timestamp || new Date().toISOString(),
      status: instruction.status || 'PENDING', // 'PENDING' | 'PARTIALLY_FINISHED' | 'TOTALLY_FINISHED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED'
      frozenAmount: Number(instruction.frozenAmount || 0),
      createdAt: instruction.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.state.instructions.push(record);
    this.persist();
    return record;
  }

  async findInstructionById(id) {
    return this.state.instructions.find(i => i.id === id || i._id === id) || null;
  }

  async getAllInstructions() {
    return [...this.state.instructions];
  }

  async getInstructionsByUserId(userId) {
    return this.state.instructions.filter(i => i.userId === userId);
  }

  async getInstructionsByStockId(stockId) {
    return this.state.instructions.filter(i => i.stockId === stockId);
  }

  async updateInstruction(id, updateFields) {
    const instruction = this.state.instructions.find(i => i.id === id || i._id === id);
    if (!instruction) return null;

    Object.keys(updateFields).forEach(key => {
      instruction[key] = updateFields[key];
    });
    instruction.updatedAt = new Date().toISOString();
    this.persist();
    return instruction;
  }

  // --- TRADE OPERATIONS ---
  async insertTrade(trade) {
    const id = trade.id || `TRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id,
      _id: id,
      buyInstructionId: trade.buyInstructionId,
      sellInstructionId: trade.sellInstructionId,
      buyerUserId: trade.buyerUserId,
      sellerUserId: trade.sellerUserId,
      stockId: trade.stockId,
      quantity: Number(trade.quantity),
      price: Number(trade.price),
      timestamp: trade.timestamp || new Date().toISOString()
    };
    this.state.trades.push(record);
    this.persist();
    return record;
  }

  async getAllTrades() {
    return [...this.state.trades];
  }

  async getTradesByStockId(stockId) {
    return this.state.trades.filter(t => t.stockId === stockId);
  }

  async getTradesByUserId(userId) {
    return this.state.trades.filter(t => t.buyerUserId === userId || t.sellerUserId === userId);
  }

  // --- LOGGING (SRS CRC Card Responsibility: Log instruction / business) ---
  async insertLog(action, details = {}) {
    const log = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    this.state.logs.push(log);
    // Limit memory/log size to keep system responsive (SRS Capacity/Overhead R08)
    if (this.state.logs.length > 2000) {
      this.state.logs.splice(0, this.state.logs.length - 2000);
    }
    this.persist();
    return log;
  }

  async getLogs(limit = 100) {
    return this.state.logs.slice(-limit).reverse();
  }

  // --- SYSTEM OPERATIONS (SRS Section 2.2.2 Exceptions) ---
  isOperationsSuspended() {
    return !!(this.state.systemConfig && this.state.systemConfig.operationsSuspended);
  }

  setOperationsSuspended(suspended) {
    if (!this.state.systemConfig) {
      this.state.systemConfig = { operationsSuspended: false };
    }
    this.state.systemConfig.operationsSuspended = !!suspended;
    this.persist();
    return this.state.systemConfig.operationsSuspended;
  }
}

export const dbManager = new ManagementOfDatabase();
export default dbManager;
