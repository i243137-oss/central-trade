# Central Trading System (CTS) — MERN Implementation

An academic, production-grade implementation of the **Central Trading System (CTS)** based on the 2007 Software Requirements Specification (SRS Version 1.0) for **SE3002: Software Quality Engineering (Assignment #01)**.

---

## 1. System Overview & Architecture

The Central Trading System provides automated order pretreatment, continuous double-auction order matching based on price-time priority, account balance freezing, and trading management controls.

### Architecture Mapping to 2007 SRS CRC Cards

The backend codebase directly reflects the object-oriented structure specified in **SRS Section 6 (CRC Index Cards)**:

| SRS CRC Class | Module File | Core Responsibility |
| :--- | :--- | :--- |
| **PretreatmentOfInstruction** | `server/services/pretreatment/PretreatmentOfInstruction.js` | Parameter legality checks, Rising/Falling limits validation (R04), Atomic buyer fund freezing (R06), Logging. |
| **ManagementOfInstruction** | `server/services/instruction/ManagementOfInstruction.js` | Adding instructions, order cancellation with exception handling (R02), searching, sweeping outdated instructions (R05). |
| **ManagementOfDealing** | `server/services/dealing/ManagementOfDealing.js` | Price-first / Time-first sorting, matching algorithm (R03), partial/total execution transitions, settlement trigger. |
| **ManagementOfDatabase** | `server/services/database/ManagementOfDatabase.js` | Data access layer with Mongoose MongoDB schemas, dual-mode fallback persistence for zero-config execution. |

---

## 2. Requirements Compliance (R01 – R10)

| Requirement | Description | Implementation Status & Verification |
| :--- | :--- | :--- |
| **R01 — Buy/Sell Stock** | Submit trading instruction with User ID, Stock ID, Type, Quantity, Respected Price, and Timestamp. | **Fully Implemented**: `POST /api/instructions`. Validates all fields per SRS 7.1.1. |
| **R02 — Cancel Instruction** | Cancel active instruction, handle already implemented / already cancelled exceptions, release frozen funds. | **Fully Implemented**: `PATCH /api/instructions/:id/cancel`. Releases frozen funds for BUY orders; rejects `TOTALLY_FINISHED` with `ALREADY_IMPLEMENTED`. |
| **R03 — Matching Mechanism** | Price-First principle (highest buy, lowest sell), Time-First principle (earlier timestamp), execution rule ($P_{buy} \ge P_{sell}$). | **Fully Implemented**: `ManagementOfDealing.js`. Updates status (`PENDING` $\to$ `PARTIALLY_FINISHED` $\to$ `TOTALLY_FINISHED`), creates Trade records, settles balances. |
| **R04 — Price Limits** | Rising Limit and Falling Limit enforcement. Instructions outside limits are rejected. | **Fully Implemented**: Checked in Pretreatment. Manager can configure limits via `PATCH /api/stocks/:id/limits`. |
| **R05 — Outdated Instructions** | Instructions active $\ge$ 24 hours are expired, removed from matching, and buyer frozen funds released. | **Fully Implemented**: Background sweeper in `server/jobs/outdatedInstructionJob.js`. Manual trigger via `POST /api/manager/outdated-sweep`. |
| **R06 — Fund Freezing** | Atomic balance freeze on BUY instructions. Available balance reduced, frozen balance increased. Settle or release. | **Fully Implemented**: `ManagementOfDatabase.freezeFunds`, `releaseFrozenFunds`, `settleTradeFunds`. Price improvements refunded. |
| **R07 — Query Interface** | Structuralized query interface for User trade info and Stock trade info. | **Fully Implemented**: `GET /api/queries/user` and `GET /api/queries/stock` per SRS 7.1.1(c) & 7.1.2. |
| **R08 — Capacity and Overhead** | System responsiveness, audit log capping (max 2000 entries), indexed queries. | **Fully Implemented**: High-performance in-memory caching + capped logs + MongoDB indexing. |
| **R09 — Modularity & Maintainability** | Clean separation of concerns matching SRS CRC cards and DFD diagrams. | **Fully Implemented**: Modular services, controllers, routes, and Mongoose models. |
| **R10 — Role-Based Authorization** | `USER` and `SYSTEM_MANAGER` roles. Strict RBAC enforcement. | **Fully Implemented**: `server/middleware/auth.js`. System manager controls protected endpoints (`/api/manager/*`). |

---

## 3. Database Architecture (MERN with Resilient Fallback)

- **Mongoose Models**: Defined in `server/models/`:
  - `User.js` — User authentication and role assignment
  - `Account.js` — Security account balance and frozen funds tracking
  - `Stock.js` — Stock symbols with Rising & Falling limits
  - `Instruction.js` — Order book instructions with compound indexes
  - `Trade.js` — Execution records
  - `Log.js` — Audit trail
  - `SystemConfig.js` — Trading suspension state
- **Connectivity**: Connects to `process.env.MONGODB_URI` (default: `mongodb://localhost:27017/cts`). If MongoDB is not running locally or in a sandbox container, CTS automatically operates using its file-backed persistent store (`data/cts_database.json`) to guarantee 100% immediate runnability without unhandled exceptions.

---

## 4. Default Demonstration Accounts

The system seeds with the following pre-configured accounts:

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

## 5. Verification & Testing

To execute the automated end-to-end verification suite testing R01 through R10:

```bash
node server/test/systemVerification.js
```

All 9 test suites verify:
1. System health check
2. Role-based authorization & token validation (R10)
3. Price limit boundaries & rejection (R04)
4. Fund freezing on order submission (R01, R06)
5. Cancellation and fund release (R02, R06)
6. Price-Time priority matching and trade settlement (R03)
7. 24-hour outdated instruction sweep (R05)
8. Structured query endpoints (R07)
9. Operational suspension exception handling (SRS Section 2.2.2)
