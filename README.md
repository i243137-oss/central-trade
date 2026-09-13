# Central Trading System (CTS) — MERN Implementation

An academic implementation of the **Central Trading System (CTS)** based on the 2007 Software Requirements Specification (SRS Version 1.0) for **SE3002: Software Quality Engineering (Assignment #01)**.

---

## Database

**MongoDB with Mongoose**

MongoDB is the only persistent database supported by the application. The application does not fall back to JSON or file-based storage when MongoDB is unavailable.

If MongoDB cannot be reached, the application reports a clear connection error and does not start.

---

## 1. System Overview & Architecture

The Central Trading System provides automated order pretreatment, continuous double-auction order matching based on price-time priority, account balance freezing, and trading management controls.

### Architecture Mapping to 2007 SRS CRC Cards

| SRS CRC Class | Module File | Core Responsibility |
| :--- | :--- | :--- |
| **PretreatmentOfInstruction** | `server/services/pretreatment/PretreatmentOfInstruction.js` | Parameter legality checks, Rising/Falling limits validation (R04), Atomic buyer fund freezing (R06), Logging. |
| **ManagementOfInstruction** | `server/services/instruction/ManagementOfInstruction.js` | Adding instructions, order cancellation with exception handling (R02), searching, sweeping outdated instructions (R05). |
| **ManagementOfDealing** | `server/services/dealing/ManagementOfDealing.js` | Price-first / Time-first sorting, matching algorithm (R03), partial/total execution transitions, settlement trigger. |
| **ManagementOfDatabase** | `server/services/database/ManagementOfDatabase.js` | Data access layer with Mongoose MongoDB models. MongoDB-only persistence. |

---

## 2. Requirements Compliance (R01 – R10)

| Req | Description | Implementation |
| :--- | :--- | :--- |
| **R01** | Buy/Sell Stock | `POST /api/instructions`. Validates all fields per SRS 7.1.1. |
| **R02** | Cancel Instruction | `PATCH /api/instructions/:id/cancel`. Releases frozen funds for BUY orders. |
| **R03** | Matching Mechanism | `ManagementOfDealing.js`. Price-First then Time-First priority. Partial matching supported. |
| **R04** | Price Limits | Checked in Pretreatment. Manager configures via `PATCH /api/stocks/:id/limits`. |
| **R05** | Outdated Instructions | Background sweeper + manual `POST /api/manager/outdated-sweep`. |
| **R06** | Fund Freezing | Atomic MongoDB `$inc` operations for concurrency safety. |
| **R07** | Query Interface | `GET /api/queries/user` and `GET /api/queries/stock`. |
| **R08** | Capacity-Conscious | Async Node.js, reusable MongoDB connection, indexed queries, pagination, centralized error handling. |
| **R09** | Maintainability | Modular services, controllers, routes, Mongoose models following SRS CRC structure. |
| **R10** | Authorization | JWT auth + role middleware. `USER` and `SYSTEM_MANAGER` roles enforced on backend. |

---

## 3. MongoDB Setup

### Option A: Local MongoDB

1. Install MongoDB Community Edition: https://www.mongodb.com/try/download/community
2. Start MongoDB:
   ```bash
   mongod --dbpath /path/to/data
   ```
3. Set environment variable:
   ```bash
   MONGODB_URI=mongodb://localhost:27017/central-trade
   ```

### Option B: MongoDB Atlas (Cloud)

1. Create a free cluster at https://cloud.mongodb.com
2. Get your connection string
3. Set environment variable:
   ```bash
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/central-trade
   ```

### Verify Connection

After starting the server, you should see:
```
[ManagementOfDatabase] Successfully connected to MongoDB at ...
```

If MongoDB is unavailable, you will see:
```
[CTS Server] Fatal startup error: ...
```
and the application will NOT start.

---

## 4. Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set your MONGODB_URI

# 3. Start in development mode (frontend + backend)
npm run dev

# 4. Or start production backend only
npm start

# 5. Open browser
# http://localhost:3000
```

---

## 5. Default Demonstration Accounts

| Role | Email | Password | Initial Balance |
| :--- | :--- | :--- | :--- |
| **System Manager** | `manager@example.com` | `admin123` | $100,000.00 |
| **Normal User 1** | `user@example.com` | `user123` | $50,000.00 |
| **Normal User 2** | `trader2@example.com` | `user123` | $50,000.00 |

### Pre-seeded Stocks

| Symbol | Name | Falling Limit | Rising Limit |
| :--- | :--- | :--- | :--- |
| **AAPL** | Apple Inc. | $95.00 | $105.00 |
| **MSFT** | Microsoft Corp. | $200.00 | $230.00 |
| **GOOG** | Alphabet Inc. | $140.00 | $165.00 |
| **TSLA** | Tesla Inc. | $180.00 | $220.00 |

---

## 6. Verification & Testing

```bash
# Run the automated end-to-end verification suite (requires server running)
node server/test/systemVerification.js
```

---

## 7. Project Structure

```
server/
├── config/           # Environment and application configuration
├── controllers/      # Express route handlers
├── middleware/        # Authentication and authorization middleware
├── models/           # Mongoose schemas (User, Account, Stock, Instruction, Trade, Log, SystemConfig)
├── routes/           # Express route definitions
├── services/
│   ├── database/     # ManagementOfDatabase (MongoDB persistence layer)
│   ├── dealing/      # ManagementOfDealing (matching engine)
│   ├── instruction/  # ManagementOfInstruction (instruction lifecycle)
│   └── pretreatment/ # PretreatmentOfInstruction (validation, limits, fund freezing)
├── jobs/             # Background workers (outdated instruction sweep)
├── seed/             # Database seed data
└── test/             # System verification tests

src/                  # React frontend (Vite + TailwindCSS)
├── context/          # AuthContext
├── layouts/          # Navbar
├── pages/            # Dashboard, Trade, Orders, OrderBook, Trades, Query, Manager, Login, Register
└── services/         # API client
```
