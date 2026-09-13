import mongoose from 'mongoose';
import config from '../../config/config.js';
import { User, Account, Stock, Instruction, Trade, Log, SystemConfig } from '../../models/index.js';

/**
 * ManagementOfDatabase
 * Corresponds directly to SRS Section 6 (CRC Index Cards, page 16)
 * Responsibility: Support the basic operations interface of database for other modules
 *
 * Persistence: MongoDB with Mongoose (ONLY).
 * The application does NOT fall back to JSON or file-based storage.
 * If MongoDB is unavailable, the application reports a clear connection error.
 */
class ManagementOfDatabase {
  constructor() {
    this.isMongoConnected = false;
  }

  /**
   * Connect to MongoDB instance using Mongoose.
   * Throws on failure — the application must NOT silently fall back.
   */
  async connectMongo(uri = config.mongoUri) {
    if (this.isMongoConnected) return true;
    if (!uri) {
      throw new Error(
        'MongoDB connection string is not configured. Please set MONGODB_URI in the environment.'
      );
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    this.isMongoConnected = true;
    console.log('[ManagementOfDatabase] Successfully connected to MongoDB at', uri);
    return true;
  }

  // --- USER OPERATIONS ---
  async findUserByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() }).lean();
  }

  async findUserById(id) {
    return await User.findOne({ id }).lean();
  }

  async getAllUsers() {
    const users = await User.find().lean();
    return users.map(u => { const { passwordHash, ...safe } = u; return safe; });
  }

  async insertUser(user) {
    const id = user.id || `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id, _id: id, name: user.name, email: user.email.toLowerCase(),
      passwordHash: user.passwordHash, role: user.role || 'USER',
      createdAt: user.createdAt || new Date().toISOString()
    };
    await User.create(record);
    return record;
  }

  // --- ACCOUNT OPERATIONS (R06 Fund Freezing) ---
  async findAccountByUserId(userId) {
    return await Account.findOne({ userId }).lean();
  }
  async getAllAccounts() { return await Account.find().lean(); }

  async insertAccount(account) {
    const id = account.id || `ACC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id, _id: id, userId: account.userId,
      totalBalance: Number(account.totalBalance || 0),
      availableBalance: Number(account.availableBalance || 0),
      frozenBalance: Number(account.frozenBalance || 0),
      updatedAt: new Date().toISOString()
    };
    await Account.create(record);
    return record;
  }

  async updateAccount(userId, updateFields) {
    return await Account.findOneAndUpdate(
      { userId }, { $set: { ...updateFields, updatedAt: new Date() } }, { new: true }
    ).lean();
  }

  /**
   * Atomic balance freeze for BUY instruction (R06 concurrency safety).
   * Uses MongoDB atomic findOneAndUpdate with $inc to prevent race conditions.
   */
  async freezeFunds(userId, amount) {
    const reqAmount = Number(amount);
    const updated = await Account.findOneAndUpdate(
      { userId, availableBalance: { $gte: reqAmount } },
      { $inc: { availableBalance: -reqAmount, frozenBalance: reqAmount }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) {
      const acct = await Account.findOne({ userId }).lean();
      if (!acct) throw new Error(`Account not found for user ${userId}`);
      throw new Error(`Insufficient available balance ($${acct.availableBalance.toFixed(2)}) for required amount ($${reqAmount.toFixed(2)})`);
    }
    return updated;
  }

  /** Release frozen funds atomically. */
  async releaseFrozenFunds(userId, amount) {
    const acct = await Account.findOne({ userId }).lean();
    if (!acct) return null;
    const rel = Math.min(acct.frozenBalance, Number(amount));
    return await Account.findOneAndUpdate(
      { userId },
      { $inc: { frozenBalance: -rel, availableBalance: rel }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();
  }

  /** Settle trade funds between buyer and seller. */
  async settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount) {
    return this._settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount, null);
  }

  async _settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount, session) {
    const exec = Number(executedAmount);
    const resp = Number(respectedAmount || executedAmount);
    const refund = resp - exec;
    const opts = session ? { session } : {};
    await Account.findOneAndUpdate({ userId: buyerUserId }, {
      $inc: { totalBalance: -exec, frozenBalance: -resp, availableBalance: refund > 0 ? refund : 0 },
      $set: { updatedAt: new Date() }
    }, opts);
    await Account.findOneAndUpdate({ userId: sellerUserId }, {
      $inc: { totalBalance: exec, availableBalance: exec },
      $set: { updatedAt: new Date() }
    }, opts);
  }

  // --- STOCK OPERATIONS ---
  async getAllStocks() { return await Stock.find().lean(); }

  async findStockById(stockId) {
    const query = stockId ? stockId.toUpperCase() : '';
    return await Stock.findOne({ $or: [{ stockId: query }, { symbol: query }] }).lean();
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
    await Stock.findOneAndUpdate({ stockId: record.stockId }, record, { upsert: true, new: true });
    return record;
  }

  async updateStockLimits(stockId, limits) {
    return await Stock.findOneAndUpdate(
      { $or: [{ stockId }, { symbol: stockId }] },
      { $set: { fallingLimit: Number(limits.fallingLimit), risingLimit: Number(limits.risingLimit), updatedAt: new Date() } },
      { new: true }
    ).lean();
  }

  // --- INSTRUCTION OPERATIONS ---
  async insertInstruction(instruction) {
    const id = instruction.id || `INST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id, _id: id, userId: instruction.userId, stockId: instruction.stockId,
      type: instruction.type, quantity: Number(instruction.quantity),
      remainingQuantity: Number(instruction.remainingQuantity !== undefined ? instruction.remainingQuantity : instruction.quantity),
      respectedPrice: Number(instruction.respectedPrice),
      timestamp: instruction.timestamp || new Date().toISOString(),
      status: instruction.status || 'PENDING',
      frozenAmount: Number(instruction.frozenAmount || 0),
      createdAt: instruction.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await Instruction.create(record);
    return record;
  }

  async findInstructionById(id) {
    return await Instruction.findOne({ id }).lean();
  }
  async getAllInstructions() { return await Instruction.find().lean(); }
  async getInstructionsByUserId(userId) { return await Instruction.find({ userId }).lean(); }
  async getInstructionsByStockId(stockId) {
    const q = stockId ? stockId.toUpperCase() : '';
    return await Instruction.find({ stockId: q }).lean();
  }

  async updateInstruction(id, updateFields) {
    return await Instruction.findOneAndUpdate(
      { id }, { $set: { ...updateFields, updatedAt: new Date().toISOString() } }, { new: true }
    ).lean();
  }

  // --- TRADE OPERATIONS ---
  async insertTrade(trade, session = null) {
    const id = trade.id || `TRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id, _id: id,
      buyInstructionId: trade.buyInstructionId, sellInstructionId: trade.sellInstructionId,
      buyerUserId: trade.buyerUserId, sellerUserId: trade.sellerUserId,
      stockId: trade.stockId, quantity: Number(trade.quantity),
      price: Number(trade.price), timestamp: trade.timestamp || new Date().toISOString()
    };
    await Trade.create([record], session ? { session } : {});
    return record;
  }

  /**
   * Execute a full trade settlement (R06/R11 concurrency review) as a single unit:
   * insert the trade record, update both matched instructions, and settle both
   * accounts.
   *
   * Uses a MongoDB (Mongoose) session transaction so that if any one write fails,
   * none of the writes are applied — preventing partially-completed financial
   * state (e.g. a trade recorded without the corresponding fund settlement).
   *
   * Transactions require a MongoDB replica set (or mongodb+srv Atlas cluster);
   * a standalone `mongod` does not support them. If the connected deployment
   * does not support transactions, this falls back to applying the same writes
   * sequentially (matching the previous behavior) and logs a one-time warning,
   * rather than crashing the trading engine.
   */
  async executeTradeSettlement({ trade, buyInstructionId, buyUpdate, sellInstructionId, sellUpdate, buyerUserId, sellerUserId, executedAmount, respectedAmount }) {
    const session = await mongoose.startSession();
    try {
      let tradeRecord;
      await session.withTransaction(async () => {
        tradeRecord = await this.insertTrade(trade, session);
        await Instruction.findOneAndUpdate(
          { id: buyInstructionId },
          { $set: { ...buyUpdate, updatedAt: new Date().toISOString() } },
          { session }
        );
        await Instruction.findOneAndUpdate(
          { id: sellInstructionId },
          { $set: { ...sellUpdate, updatedAt: new Date().toISOString() } },
          { session }
        );
        await this._settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount, session);
      });
      return tradeRecord;
    } catch (err) {
      const transactionsUnsupported = /Transaction numbers are only allowed on a replica set member|IllegalOperation|Transactions are not supported/i.test(err.message || '');
      if (!transactionsUnsupported) {
        throw err;
      }
      if (!this._warnedNoTransactions) {
        console.warn(
          '[ManagementOfDatabase] MongoDB transactions are not supported by this deployment ' +
          '(standalone mongod, not a replica set). Falling back to sequential writes for trade ' +
          'settlement; cross-document atomicity is not guaranteed on this deployment.'
        );
        this._warnedNoTransactions = true;
      }
      const tradeRecord = await this.insertTrade(trade);
      await this.updateInstruction(buyInstructionId, buyUpdate);
      await this.updateInstruction(sellInstructionId, sellUpdate);
      await this._settleTradeFunds(buyerUserId, sellerUserId, executedAmount, respectedAmount);
      return tradeRecord;
    } finally {
      await session.endSession();
    }
  }

  async getAllTrades() { return await Trade.find().lean(); }
  async getTradesByStockId(stockId) {
    const q = stockId ? stockId.toUpperCase() : '';
    return await Trade.find({ stockId: q }).lean();
  }
  async getTradesByUserId(userId) {
    return await Trade.find({ $or: [{ buyerUserId: userId }, { sellerUserId: userId }] }).lean();
  }

  // --- LOGGING ---
  async insertLog(action, details = {}) {
    const log = { id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`, action, details, timestamp: new Date().toISOString() };
    await Log.create(log);
    return log;
  }
  async getLogs(limit = 100) { return await Log.find().sort({ timestamp: -1 }).limit(limit).lean(); }

  // --- SYSTEM OPERATIONS (SRS Section 2.2.2 Exceptions) ---
  async isOperationsSuspended() {
    const cfg = await SystemConfig.findOne({ key: 'CTS_SYSTEM_CONFIG' }).lean();
    return !!(cfg && cfg.operationsSuspended);
  }
  async setOperationsSuspended(suspended) {
    await SystemConfig.findOneAndUpdate(
      { key: 'CTS_SYSTEM_CONFIG' },
      { operationsSuspended: !!suspended, updatedAt: new Date() },
      { upsert: true }
    );
    return !!suspended;
  }

  /** Clear all collections — used for database reset during testing/seeding. */
  async clearAllCollections() {
    await User.deleteMany({});
    await Account.deleteMany({});
    await Stock.deleteMany({});
    await Instruction.deleteMany({});
    await Trade.deleteMany({});
    await Log.deleteMany({});
    await SystemConfig.deleteMany({});
  }
}

export const dbManager = new ManagementOfDatabase();
export default dbManager;

