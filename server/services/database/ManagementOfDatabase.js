import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import config from '../../config/config.js';
import { User, Account, Stock, Instruction, Trade, Log, SystemConfig } from '../../models/index.js';

/**
 * ManagementOfDatabase
 * Corresponds directly to SRS Section 6 (CRC Index Cards, page 16)
 * Responsibility: Support the basic operations interface of database for other modules
 * Supports Account operations, Stock operations, Instruction operations, Trade operations, User operations.
 * Implements MERN MongoDB integration with Mongoose models, plus resilient dual-mode persistence.
 */
class ManagementOfDatabase {
  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dbFile = path.resolve(this.dataDir, 'cts_database.json');
    this.isMongoConnected = false;
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
      console.error('[ManagementOfDatabase] Error initializing local store:', err);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[ManagementOfDatabase] Persistence error:', err);
    }
  }

  /**
   * Connect to MongoDB instance using Mongoose
   */
  async connectMongo(uri = config.mongoUri) {
    if (this.isMongoConnected) return true;
    try {
      if (!uri) return false;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000
      });
      this.isMongoConnected = true;
      console.log('[ManagementOfDatabase] Successfully connected to MongoDB at', uri);
      await this.syncWithMongo();
      return true;
    } catch (err) {
      console.log(`[ManagementOfDatabase] MongoDB connection skipped (${err.message}). Using resilient local storage.`);
      this.isMongoConnected = false;
      return false;
    }
  }

  /**
   * Sync data between MongoDB and local state cache
   */
  async syncWithMongo() {
    if (!this.isMongoConnected) return;
    try {
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        // Hydrate in-memory state from MongoDB
        const users = await User.find().lean();
        const accounts = await Account.find().lean();
        const stocks = await Stock.find().lean();
        const instructions = await Instruction.find().lean();
        const trades = await Trade.find().lean();
        const logs = await Log.find().sort({ timestamp: -1 }).limit(2000).lean();
        const sysCfg = await SystemConfig.findOne({ key: 'CTS_SYSTEM_CONFIG' }).lean();

        this.state.users = users;
        this.state.accounts = accounts;
        this.state.stocks = stocks;
        this.state.instructions = instructions;
        this.state.trades = trades;
        this.state.logs = logs.reverse();
        if (sysCfg) {
          this.state.systemConfig = { operationsSuspended: !!sysCfg.operationsSuspended };
        }
        this.persist();
      } else if (this.state.users.length > 0) {
        // Push initial state to MongoDB
        for (const u of this.state.users) {
          await User.findOneAndUpdate({ id: u.id }, u, { upsert: true });
        }
        for (const a of this.state.accounts) {
          await Account.findOneAndUpdate({ id: a.id }, a, { upsert: true });
        }
        for (const s of this.state.stocks) {
          await Stock.findOneAndUpdate({ stockId: s.stockId }, s, { upsert: true });
        }
        for (const i of this.state.instructions) {
          await Instruction.findOneAndUpdate({ id: i.id }, i, { upsert: true });
        }
        for (const t of this.state.trades) {
          await Trade.findOneAndUpdate({ id: t.id }, t, { upsert: true });
        }
        for (const l of this.state.logs) {
          await Log.findOneAndUpdate({ id: l.id }, l, { upsert: true });
        }
        await SystemConfig.findOneAndUpdate(
          { key: 'CTS_SYSTEM_CONFIG' },
          { operationsSuspended: this.isOperationsSuspended() },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn('[ManagementOfDatabase] Error syncing with MongoDB:', err.message);
    }
  }

  // --- USER OPERATIONS ---
  async findUserByEmail(email) {
    if (this.isMongoConnected) {
      try {
        const found = await User.findOne({ email: email.toLowerCase() }).lean();
        if (found) return found;
      } catch (err) {
        console.warn('[ManagementOfDatabase.findUserByEmail] Mongo fallback:', err.message);
      }
    }
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(id) {
    if (this.isMongoConnected) {
      try {
        const found = await User.findOne({ id }).lean();
        if (found) return found;
      } catch (err) {
        console.warn('[ManagementOfDatabase.findUserById] Mongo fallback:', err.message);
      }
    }
    return this.state.users.find(u => u.id === id || u._id === id) || null;
  }

  async getAllUsers() {
    if (this.isMongoConnected) {
      try {
        const users = await User.find().lean();
        return users.map(u => {
          const { passwordHash, ...safe } = u;
          return safe;
        });
      } catch (err) {
        console.warn('[ManagementOfDatabase.getAllUsers] Mongo fallback:', err.message);
      }
    }
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

    if (this.isMongoConnected) {
      try {
        await User.create(record);
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertUser] Mongo error:', err.message);
      }
    }

    this.state.users.push(record);
    this.persist();
    return record;
  }

  // --- ACCOUNT OPERATIONS (R06 Fund Freezing) ---
  async findAccountByUserId(userId) {
    if (this.isMongoConnected) {
      try {
        const acc = await Account.findOne({ userId }).lean();
        if (acc) return acc;
      } catch (err) {
        console.warn('[ManagementOfDatabase.findAccountByUserId] Mongo fallback:', err.message);
      }
    }
    return this.state.accounts.find(a => a.userId === userId) || null;
  }

  async getAllAccounts() {
    if (this.isMongoConnected) {
      try {
        return await Account.find().lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getAllAccounts] Mongo fallback:', err.message);
      }
    }
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

    if (this.isMongoConnected) {
      try {
        await Account.create(record);
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertAccount] Mongo error:', err.message);
      }
    }

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

    if (this.isMongoConnected) {
      try {
        await Account.updateOne({ userId }, { $set: updateFields });
      } catch (err) {
        console.warn('[ManagementOfDatabase.updateAccount] Mongo error:', err.message);
      }
    }

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

    if (this.isMongoConnected) {
      try {
        await Account.updateOne(
          { userId },
          {
            $set: {
              availableBalance: account.availableBalance,
              frozenBalance: account.frozenBalance,
              updatedAt: new Date()
            }
          }
        );
      } catch (err) {
        console.warn('[ManagementOfDatabase.freezeFunds] Mongo error:', err.message);
      }
    }

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

    if (this.isMongoConnected) {
      try {
        await Account.updateOne(
          { userId },
          {
            $set: {
              availableBalance: account.availableBalance,
              frozenBalance: account.frozenBalance,
              updatedAt: new Date()
            }
          }
        );
      } catch (err) {
        console.warn('[ManagementOfDatabase.releaseFrozenFunds] Mongo error:', err.message);
      }
    }

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
      
      buyerAccount.totalBalance -= exec;
      buyerAccount.frozenBalance -= resp;
      const refund = resp - exec;
      if (refund > 0) {
        buyerAccount.availableBalance += refund;
      }
      buyerAccount.updatedAt = new Date().toISOString();

      if (this.isMongoConnected) {
        try {
          await Account.updateOne(
            { userId: buyerUserId },
            {
              $set: {
                totalBalance: buyerAccount.totalBalance,
                frozenBalance: buyerAccount.frozenBalance,
                availableBalance: buyerAccount.availableBalance,
                updatedAt: new Date()
              }
            }
          );
        } catch (err) {
          console.warn('[ManagementOfDatabase.settleTradeFunds] Buyer Mongo error:', err.message);
        }
      }
    }

    if (sellerAccount) {
      const exec = Number(executedAmount);
      sellerAccount.totalBalance += exec;
      sellerAccount.availableBalance += exec;
      sellerAccount.updatedAt = new Date().toISOString();

      if (this.isMongoConnected) {
        try {
          await Account.updateOne(
            { userId: sellerUserId },
            {
              $set: {
                totalBalance: sellerAccount.totalBalance,
                availableBalance: sellerAccount.availableBalance,
                updatedAt: new Date()
              }
            }
          );
        } catch (err) {
          console.warn('[ManagementOfDatabase.settleTradeFunds] Seller Mongo error:', err.message);
        }
      }
    }

    this.persist();
  }

  // --- STOCK OPERATIONS ---
  async getAllStocks() {
    if (this.isMongoConnected) {
      try {
        return await Stock.find().lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getAllStocks] Mongo fallback:', err.message);
      }
    }
    return [...this.state.stocks];
  }

  async findStockById(stockId) {
    const query = stockId ? stockId.toUpperCase() : '';
    if (this.isMongoConnected) {
      try {
        const stock = await Stock.findOne({
          $or: [{ stockId: query }, { symbol: query }]
        }).lean();
        if (stock) return stock;
      } catch (err) {
        console.warn('[ManagementOfDatabase.findStockById] Mongo fallback:', err.message);
      }
    }
    return this.state.stocks.find(s => s.stockId === query || s.symbol === query) || null;
  }

  async insertStock(stock) {
    const record = {
      stockId: (stock.stockId || stock.symbol).toUpperCase(),
      symbol: stock.symbol.toUpperCase(),
      name: stock.name,
      fallingLimit: Number(stock.fallingLimit),
      risingLimit: Number(stock.risingLimit),
      createdAt: stock.createdAt || new Date().toISOString()
    };

    if (this.isMongoConnected) {
      try {
        await Stock.findOneAndUpdate(
          { stockId: record.stockId },
          record,
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertStock] Mongo error:', err.message);
      }
    }

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

    if (this.isMongoConnected) {
      try {
        await Stock.updateOne(
          { stockId: stock.stockId },
          {
            $set: {
              fallingLimit: stock.fallingLimit,
              risingLimit: stock.risingLimit
            }
          }
        );
      } catch (err) {
        console.warn('[ManagementOfDatabase.updateStockLimits] Mongo error:', err.message);
      }
    }

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
      status: instruction.status || 'PENDING',
      frozenAmount: Number(instruction.frozenAmount || 0),
      createdAt: instruction.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isMongoConnected) {
      try {
        await Instruction.create(record);
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertInstruction] Mongo error:', err.message);
      }
    }

    this.state.instructions.push(record);
    this.persist();
    return record;
  }

  async findInstructionById(id) {
    if (this.isMongoConnected) {
      try {
        const inst = await Instruction.findOne({ id }).lean();
        if (inst) return inst;
      } catch (err) {
        console.warn('[ManagementOfDatabase.findInstructionById] Mongo fallback:', err.message);
      }
    }
    return this.state.instructions.find(i => i.id === id || i._id === id) || null;
  }

  async getAllInstructions() {
    if (this.isMongoConnected) {
      try {
        return await Instruction.find().lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getAllInstructions] Mongo fallback:', err.message);
      }
    }
    return [...this.state.instructions];
  }

  async getInstructionsByUserId(userId) {
    if (this.isMongoConnected) {
      try {
        return await Instruction.find({ userId }).lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getInstructionsByUserId] Mongo fallback:', err.message);
      }
    }
    return this.state.instructions.filter(i => i.userId === userId);
  }

  async getInstructionsByStockId(stockId) {
    const query = stockId ? stockId.toUpperCase() : '';
    if (this.isMongoConnected) {
      try {
        return await Instruction.find({ stockId: query }).lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getInstructionsByStockId] Mongo fallback:', err.message);
      }
    }
    return this.state.instructions.filter(i => i.stockId === query);
  }

  async updateInstruction(id, updateFields) {
    const instruction = this.state.instructions.find(i => i.id === id || i._id === id);
    if (!instruction) return null;

    Object.keys(updateFields).forEach(key => {
      instruction[key] = updateFields[key];
    });
    instruction.updatedAt = new Date().toISOString();

    if (this.isMongoConnected) {
      try {
        await Instruction.updateOne({ id }, { $set: updateFields });
      } catch (err) {
        console.warn('[ManagementOfDatabase.updateInstruction] Mongo error:', err.message);
      }
    }

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

    if (this.isMongoConnected) {
      try {
        await Trade.create(record);
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertTrade] Mongo error:', err.message);
      }
    }

    this.state.trades.push(record);
    this.persist();
    return record;
  }

  async getAllTrades() {
    if (this.isMongoConnected) {
      try {
        return await Trade.find().lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getAllTrades] Mongo fallback:', err.message);
      }
    }
    return [...this.state.trades];
  }

  async getTradesByStockId(stockId) {
    const query = stockId ? stockId.toUpperCase() : '';
    if (this.isMongoConnected) {
      try {
        return await Trade.find({ stockId: query }).lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getTradesByStockId] Mongo fallback:', err.message);
      }
    }
    return this.state.trades.filter(t => t.stockId === query);
  }

  async getTradesByUserId(userId) {
    if (this.isMongoConnected) {
      try {
        return await Trade.find({
          $or: [{ buyerUserId: userId }, { sellerUserId: userId }]
        }).lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getTradesByUserId] Mongo fallback:', err.message);
      }
    }
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

    if (this.isMongoConnected) {
      try {
        await Log.create(log);
      } catch (err) {
        console.warn('[ManagementOfDatabase.insertLog] Mongo error:', err.message);
      }
    }

    this.state.logs.push(log);
    // Limit memory/log size to keep system responsive (SRS Capacity/Overhead R08)
    if (this.state.logs.length > 2000) {
      this.state.logs.splice(0, this.state.logs.length - 2000);
    }
    this.persist();
    return log;
  }

  async getLogs(limit = 100) {
    if (this.isMongoConnected) {
      try {
        return await Log.find().sort({ timestamp: -1 }).limit(limit).lean();
      } catch (err) {
        console.warn('[ManagementOfDatabase.getLogs] Mongo fallback:', err.message);
      }
    }
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

    if (this.isMongoConnected) {
      SystemConfig.findOneAndUpdate(
        { key: 'CTS_SYSTEM_CONFIG' },
        { operationsSuspended: !!suspended, updatedAt: new Date() },
        { upsert: true }
      ).catch(err => console.warn('[ManagementOfDatabase.setOperationsSuspended] Mongo error:', err.message));
    }

    this.persist();
    return this.state.systemConfig.operationsSuspended;
  }
}

export const dbManager = new ManagementOfDatabase();
export default dbManager;
